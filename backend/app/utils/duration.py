from typing import Union

def parse_duration(v: Union[float, str]) -> float:
    """
    Parses a duration that can be either a float (decimal hours) 
    or a string in "HH:mm" format.
    Returns decimal hours as a float.
    """
    if isinstance(v, (int, float)):
        return float(v)
    
    if isinstance(v, str):
        if ":" in v:
            try:
                parts = v.split(":")
                # Handle cases like "1760:30" or "-01:15"
                hours = float(parts[0])
                minutes = float(parts[1])
                
                # Sign handling for negative durations if ever needed
                sign = -1 if hours < 0 or parts[0].startswith("-") else 1
                
                return abs(hours) + (minutes / 60.0) * sign
            except (ValueError, IndexError):
                # Fallback to float parsing if HH:mm fails
                try:
                    return float(v)
                except ValueError:
                    return 0.0
        else:
            try:
                return float(v)
            except ValueError:
                return 0.0
                
    return 0.0

def format_duration(hours: float) -> str:
    """
    Formats decimal hours into HH:mm format.
    """
    if hours is None:
        return "00:00"
    
    abs_hours = abs(hours)
    h = int(abs_hours)
    m = int(round((abs_hours - h) * 60))
    
    # Handle rounding overflow (e.g., 59.99 minutes rounding to 60)
    if m >= 60:
        h += 1
        m = 0
        
    prefix = "-" if hours < 0 else ""
    return f"{prefix}{h:02d}:{m:02d}"
