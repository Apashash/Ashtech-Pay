from pathlib import Path
import fitz

source = Path("attached_assets/Notes_260916_095505_1789548969012.pdf")
output = Path(".agents/outputs/notes_260916/contact-sheet.png")
document = fitz.open(source)

thumb_w, thumb_h = 180, 255
label_h = 24
columns = 6
rows = (len(document) + columns - 1) // columns
sheet = fitz.Pixmap(fitz.csRGB, fitz.Rect(0, 0, columns * thumb_w, rows * (thumb_h + label_h)), 0)
sheet.set_rect(sheet.irect, (255, 255, 255))

for index, page in enumerate(document):
    pix = page.get_pixmap(matrix=fitz.Matrix(thumb_w / page.rect.width, thumb_h / page.rect.height), alpha=False)
    x = (index % columns) * thumb_w
    y = (index // columns) * (thumb_h + label_h)
    sheet.copy(pix, fitz.IRect(x, y, x + pix.width, y + pix.height))

sheet.save(output)
print(output)