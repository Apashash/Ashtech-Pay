from pathlib import Path
import fitz

source = Path("attached_assets/AshTech_Pay_AI_Integration_Skill_Specification-1_1789472732343.pdf")
output_dir = Path(".agents/outputs/ai-skill-spec")
output_dir.mkdir(parents=True, exist_ok=True)

document = fitz.open(source)
print(f"pages={document.page_count}")
for page_number, page in enumerate(document, start=1):
    pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    output = output_dir / f"page-{page_number:02d}.png"
    pixmap.save(output)
    print(f"rendered={output}")