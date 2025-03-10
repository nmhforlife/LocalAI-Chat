from models.settings import Settings

def get_settings():
    """Get application settings."""
    return Settings.load() 