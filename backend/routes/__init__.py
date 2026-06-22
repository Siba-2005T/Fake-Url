"""
routes/__init__.py - Export các Blueprint
"""
from .links import links_bp
from .redirect import redirect_bp
from .media import media_bp
from .auth import auth_bp

__all__ = ["links_bp", "redirect_bp", "media_bp", "auth_bp"]
