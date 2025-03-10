from typing import List, Optional, Dict, Any
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from models import Document
from config import get_settings
import logging
import uuid
import os
from pathlib import Path

logger = logging.getLogger(__name__)
settings = get_settings()

class RAGService:
    def __init__(self):
        # Ensure the persistence directory exists
        persist_dir = Path(settings.chroma_persist_directory)
        persist_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize ChromaDB with proper persistence settings
        self.client = chromadb.PersistentClient(path=str(persist_dir))
        
        # Get or create the collection
        self.collection = self.client.get_or_create_collection(
            name="documents",
            metadata={"hnsw:space": "cosine"}  # Explicitly set distance metric
        )
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Log the current state
        count = self.collection.count()
        logger.info(f"Initialized RAG service with {count} documents in collection")

    def add_documents(self, documents: List[Document]) -> None:
        """Add documents to the vector store."""
        if not documents:
            logger.warning("No documents provided to add_documents")
            return

        texts = [doc.content for doc in documents]
        embeddings = self.embedding_model.encode(texts).tolist()
        
        # Generate unique IDs for each document if not provided
        doc_ids = [doc.id if doc.id else str(uuid.uuid4()) for doc in documents]
        
        # Add documents to Chroma
        self.collection.add(
            embeddings=embeddings,
            documents=texts,
            ids=doc_ids,
            metadatas=[doc.metadata for doc in documents]
        )
        logger.info(f"Added {len(documents)} documents to the collection")

    def search(
        self, 
        query: str, 
        n_results: int = 5,
        where: Optional[Dict[str, Any]] = None,
        where_document: Optional[Dict[str, Any]] = None,
        min_relevance_score: float = 0.0,
        include_metadata: bool = True,
        hybrid_search: bool = True
    ) -> List[Document]:
        """
        Search for similar documents with enhanced capabilities.
        
        Args:
            query: The search query
            n_results: Number of results to return (default: 5)
            where: Filter by metadata fields
            where_document: Filter by document content
            min_relevance_score: Minimum relevance score threshold (0.0 to 1.0)
            include_metadata: Whether to include metadata in results
            hybrid_search: Whether to use hybrid search (combine semantic and keyword matching)
        
        Returns:
            List of relevant documents
        """
        try:
            logger.debug(f"Searching for documents with query: '{query}'")
            logger.debug(f"Search parameters: n_results={n_results}, where={where}, "
                      f"where_document={where_document}, min_score={min_relevance_score}, "
                      f"hybrid={hybrid_search}")
            
            # Check if there are any documents in the collection
            count = self.collection.count()
            logger.debug(f"Collection contains {count} documents")
            
            if count == 0:
                logger.warning("No documents in collection to search")
                return []
            
            # Generate query embedding
            query_embedding = self.embedding_model.encode(query).tolist()
            logger.debug(f"Generated query embedding with {len(query_embedding)} dimensions")
            
            # Prepare search parameters
            search_params = {
                "query_embeddings": [query_embedding],
                "n_results": min(count, n_results * 2),  # Get more results initially for filtering
            }
            
            # Add filters if provided
            if where:
                search_params["where"] = where
            if where_document:
                search_params["where_document"] = where_document
            
            # If hybrid search is enabled, include the text query
            if hybrid_search:
                search_params["query_texts"] = [query]
                search_params["include"] = ["metadatas", "documents", "distances", "embeddings"]
            
            # Perform the search
            results = self.collection.query(**search_params)
            
            logger.debug(f"Raw search results: {results}")
            
            if not results or not results['documents'] or not results['documents'][0]:
                logger.warning("No documents found in search results")
                return []
            
            # Process and filter results
            documents = []
            for i in range(len(results['documents'][0])):
                # Calculate normalized score (convert distance to similarity score)
                score = 1.0 - (results['distances'][0][i] if 'distances' in results else 0.0)
                
                # Skip if below minimum relevance score
                if score < min_relevance_score:
                    continue
                
                # Create document with metadata if requested
                metadata = results['metadatas'][0][i] if include_metadata and results['metadatas'] else {}
                metadata['relevance_score'] = score
                
                doc = Document(
                    id=results['ids'][0][i],
                    content=results['documents'][0][i],
                    metadata=metadata
                )
                documents.append(doc)
            
            # Sort by relevance score
            documents.sort(key=lambda x: x.metadata.get('relevance_score', 0.0), reverse=True)
            
            # Trim to requested number of results
            documents = documents[:n_results]
            
            logger.debug(f"Found {len(documents)} relevant documents")
            for i, doc in enumerate(documents):
                logger.debug(f"Document {i+1}: id={doc.id}, "
                         f"filename={doc.metadata.get('filename', 'unknown')}, "
                         f"score={doc.metadata.get('relevance_score', 0.0):.3f}, "
                         f"size={len(doc.content)} chars")
            
            return documents
            
        except Exception as e:
            logger.error(f"Error searching documents: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return []

    def list_documents(self) -> List[Document]:
        """List all documents in the collection."""
        try:
            results = self.collection.get()
            if not results or not results['documents']:
                logger.info("No documents found in collection")
                return []
            
            documents = []
            for i in range(len(results['documents'])):
                doc = Document(
                    id=results['ids'][i],
                    content=results['documents'][i],
                    metadata=results['metadatas'][i] if results['metadatas'] else {}
                )
                documents.append(doc)
            
            return documents
        except Exception as e:
            logger.error(f"Error listing documents: {str(e)}")
            return []

    def delete_document(self, doc_id: str) -> bool:
        """Delete a document from the collection."""
        try:
            self.collection.delete(ids=[doc_id])
            logger.info(f"Deleted document with ID: {doc_id}")
            return True
        except Exception as e:
            logger.error(f"Error deleting document: {str(e)}")
            return False

    def get_relevant_context(self, query: str, max_length: int = 4000) -> str:
        """
        Get relevant context for a query with improved context building.
        
        Args:
            query: The search query
            max_length: Maximum length of the returned context
        
        Returns:
            Formatted context string
        """
        logger.debug(f"Getting relevant context for query: '{query}'")
        
        if not query:
            logger.warning("Empty query provided to get_relevant_context")
            return ""

        # Get relevant documents with hybrid search and scoring
        relevant_docs = self.search(
            query=query,
            n_results=5,
            min_relevance_score=0.3,
            hybrid_search=True
        )
        
        if not relevant_docs:
            logger.info("No relevant documents found for context")
            return ""

        # Build context with document boundaries and relevance scores
        context_parts = []
        total_length = 0
        logger.debug(f"Building context from {len(relevant_docs)} documents")
        
        for i, doc in enumerate(relevant_docs):
            # Extract title or filename from metadata
            title = doc.metadata.get('title', doc.metadata.get('filename', f'Document {i+1}'))
            score = doc.metadata.get('relevance_score', 0.0)
            
            # Add document header with metadata
            header = f"# {title} (Relevance: {score:.2f})"
            context_parts.append(header)
            
            # Add document content, truncated if needed
            content = doc.content
            remaining_length = max_length - total_length - len(header) - 4  # Account for separators
            
            if remaining_length <= 0:
                break
                
            if len(content) > remaining_length:
                content = content[:remaining_length] + "..."
            
            context_parts.append(content)
            context_parts.append("-" * 40)  # Separator
            
            total_length += len(header) + len(content) + 44  # Account for newlines and separator
            
            if total_length >= max_length:
                break
        
        # Add a system instruction to help the model use the context
        system_instruction = (
            "Below is relevant context from the knowledge base. "
            "Use this information to provide accurate and relevant responses to the user's questions. "
            "The context is ordered by relevance, with relevance scores indicating the confidence level. "
            "If the context doesn't contain sufficient information, rely on your general knowledge while "
            "being transparent about what information comes from the context versus your general knowledge."
        )
        
        # Join parts with newlines, avoiding backslash in f-string
        parts_joined = "\n\n".join(context_parts)
        final_context = f"{system_instruction}\n\n{parts_joined}"
        logger.debug(f"Final context size: {len(final_context)} characters")
        
        return final_context 