import time
import logging
from typing import Dict, Tuple
from app.config import settings

logger = logging.getLogger(__name__)

class SecurityManager:
    """
    In-memory manager to track failed attempts and handle IP blocking.
    Note: Since this is in-memory, it will reset on server restart.
    """
    def __init__(self):
        # Dictionary structure: {ip: (failed_attempts, last_attempt_time, blocked_until, last_order_code)}
        self._ip_stats: Dict[str, Dict] = {}

    def is_blocked(self, ip: str) -> Tuple[bool, int]:
        """
        Checks if an IP is currently blocked.
        Returns (is_blocked, minutes_remaining)
        """
        if ip not in self._ip_stats:
            return False, 0
        
        stats = self._ip_stats[ip]
        if stats.get('blocked_until', 0) > time.time():
            remaining_seconds = int(stats['blocked_until'] - time.time())
            remaining_minutes = max(1, remaining_seconds // 60)
            return True, remaining_minutes
        
        # If block time passed, we don't auto-reset attempts here, 
        # but the next failed attempt will handle it or a success will clear it.
        return False, 0

    def track_failed_attempt(self, ip: str, order_code: str) -> bool:
        """
        Tracks a failed attempt. Returns True if the IP has just been blocked.
        """
        now = time.time()
        
        if ip not in self._ip_stats:
            self._ip_stats[ip] = {
                'attempts': 1,
                'last_attempt': now,
                'blocked_until': 0,
                'last_order_code': order_code
            }
            return False

        stats = self._ip_stats[ip]
        
        # If it's been more than 24h since last attempt, reset counter
        if now - stats['last_attempt'] > 86400:
            stats['attempts'] = 1
        else:
            stats['attempts'] += 1
            
        stats['last_attempt'] = now
        stats['last_order_code'] = order_code

        if stats['attempts'] >= settings.BRUTE_FORCE_MAX_ATTEMPTS:
            stats['blocked_until'] = now + (settings.BRUTE_FORCE_BLOCK_MINUTES * 60)
            logger.warning(f"THRESHOLD REACHED for IP {ip}: {stats['attempts']} attempts. Blocking for {settings.BRUTE_FORCE_BLOCK_MINUTES} minutes.")
            return True
            
        logger.info(f"Failed attempt {stats['attempts']}/{settings.BRUTE_FORCE_MAX_ATTEMPTS} for IP {ip}")
        return False

    def reset_attempts(self, ip: str):
        """Clears stats for an IP after a successful login."""
        if ip in self._ip_stats:
            del self._ip_stats[ip]

# Singleton instance
security_manager = SecurityManager()
