from pathlib import Path
import fitz

source = Path("attached_assets/Notes_260916_095505_1789548969012.pdf")
output_dir = Path(".agents/outputs/notes_260916")
output_dir.mkdir(parents=True, exist_ok=True)

document = fitz.open(source)
for page_number, page in enumerate(document, start=1):
    pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    output_path = output_dir / f"page-{page_number}.png"
    pixmap.save(output_path)
    print(output_path)