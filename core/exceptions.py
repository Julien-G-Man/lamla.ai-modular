# A base class for all custom service-related exceptions.
# This allows for consistent error handling across the application.
class ServiceError(Exception):
    """Base class for service-related errors."""
    pass

# Specific errors for better granularity in try/except blocks.
# API integrations are a common point of failure, so a dedicated
# error class for them is a good practice.
class APIIntegrationError(ServiceError):
    """Raised when there is an issue with a third-party API integration."""
    pass

# You can add more specific exceptions as you refactor and identify
# common failure points.
class FileProcessingError(Exception):
    """Raised when there is an error processing a file."""
    pass
