import os
import re
from pathlib import Path

def process_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Pattern for `.dict()` -> `.model_dump()`
    content = re.sub(r'\.dict\(([^)]*)\)', r'.model_dump(\1)', content)

    # Pattern for `class Config:` -> `model_config = ConfigDict(...)`
    # We will just do a simple replacement for typical cases
    if "class Config:" in content and "from_attributes = True" in content:
        content = content.replace(
            "class Config:\n        from_attributes = True",
            "model_config = ConfigDict(from_attributes=True)"
        )
        if "from pydantic import" in content and "ConfigDict" not in content:
            content = content.replace("from pydantic import BaseModel", "from pydantic import BaseModel, ConfigDict")
            # Or just append import at top if needed
            if "ConfigDict" not in content:
                content = "from pydantic import ConfigDict\n" + content
    
    # Pattern for Annotated dependencies
    # e.g.: user_id: UUID = Path(...) -> user_id: Annotated[UUID, Path(...)]
    # Match: (name): (type) = (Depends|Query|Path|Body)(...)
    # Warning: this regex might be a bit loose but works for typical FastAPI code
    
    annotated_pattern = re.compile(r'([a-zA-Z0-9_]+)\s*:\s*([^=\n]+?)\s*=\s*(Depends|Query|Path|Body)\(([^)]*)\)')
    
    def replacer(match):
        var_name = match.group(1)
        var_type = match.group(2).strip()
        dep_type = match.group(3)
        dep_args = match.group(4)
        
        # If it's already Annotated, leave it
        if var_type.startswith("Annotated["):
            return match.group(0)
            
        return f"{var_name}: Annotated[{var_type}, {dep_type}({dep_args})]"

    new_content, count = annotated_pattern.subn(replacer, content)
    
    if count > 0 and 'Annotated' not in new_content:
        new_content = "from typing import Annotated\n" + new_content

    # Additional pattern for implicit types (e.g. current_user = Depends(get_current_user))
    implicit_pattern = re.compile(r'([a-zA-Z0-9_]+)\s*=\s*(Depends|Query|Path|Body)\(([^)]*)\)')
    def implicit_replacer(match):
        # We can't know the exact type, but we can't use Annotated without a type.
        # Actually in FastAPI we can just use typing.Any as a fallback, or we skip implicit
        # Let's skip implicit for now to avoid typing.Any, user might prefer us to add the correct type manually
        return match.group(0)
        
    new_content, count_implicit = implicit_pattern.subn(implicit_replacer, new_content)

    if new_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {file_path}")

def main():
    backend_dir = Path("backend/app")
    for root, _, files in os.walk(backend_dir):
        for file in files:
            if file.endswith('.py'):
                process_file(os.path.join(root, file))

if __name__ == "__main__":
    main()
