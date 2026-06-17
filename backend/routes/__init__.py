"""
routes/__init__.py - Export các Blueprint
"""
from .links import links_bp
from .redirect import redirect_bp

__all__ = ["links_bp", "redirect_bp"]
