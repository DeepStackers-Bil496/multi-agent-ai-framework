#!/usr/bin/env python3
import datetime
import re
import zipfile
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, tostring

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
CP_NS = "http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
DC_NS = "http://purl.org/dc/elements/1.1/"
DCTERMS_NS = "http://purl.org/dc/terms/"
XSI_NS = "http://www.w3.org/2001/XMLSchema-instance"

NSMAP = {
    "w": W_NS,
    "r": R_NS,
    "cp": CP_NS,
    "dc": DC_NS,
    "dcterms": DCTERMS_NS,
    "xsi": XSI_NS,
}

for prefix, uri in NSMAP.items():
    Element(f"{{{uri}}}dummy")  # ensure namespace use in serialization paths


def w(tag: str) -> str:
    return f"{{{W_NS}}}{tag}"


def add_run(paragraph, text: str, bold: bool = False, code: bool = False, size_half_points: int | None = None):
    r = SubElement(paragraph, w("r"))
    rpr = SubElement(r, w("rPr"))
    if bold:
        SubElement(rpr, w("b"))
    if code:
        rfonts = SubElement(rpr, w("rFonts"))
        rfonts.set(w("ascii"), "Consolas")
        rfonts.set(w("hAnsi"), "Consolas")
        rfonts.set(w("cs"), "Consolas")
    if size_half_points is not None:
        sz = SubElement(rpr, w("sz"))
        sz.set(w("val"), str(size_half_points))
        szcs = SubElement(rpr, w("szCs"))
        szcs.set(w("val"), str(size_half_points))
    t = SubElement(r, w("t"))
    if text.startswith(" ") or text.endswith(" ") or "  " in text:
        t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    t.text = text


def add_paragraph(body, text: str = "", style: str | None = None, bold: bool = False, code: bool = False, size_half_points: int | None = None):
    p = SubElement(body, w("p"))
    if style:
        ppr = SubElement(p, w("pPr"))
        pstyle = SubElement(ppr, w("pStyle"))
        pstyle.set(w("val"), style)
    add_run(p, text, bold=bold, code=code, size_half_points=size_half_points)
    return p


def add_code_paragraph(body, text: str):
    # Apply simple shaded-like style via monospace and small size
    p = SubElement(body, w("p"))
    ppr = SubElement(p, w("pPr"))
    pstyle = SubElement(ppr, w("pStyle"))
    pstyle.set(w("val"), "Code")
    add_run(p, text, code=True, size_half_points=20)


def parse_table(lines: list[str], start: int):
    rows = []
    i = start
    while i < len(lines):
        line = lines[i]
        if not line.strip().startswith("|"):
            break
        rows.append(line.rstrip("\n"))
        i += 1
    # Need at least header + separator + one row
    if len(rows) < 2:
        return None, start + 1

    # Remove alignment separator row (second row)
    parsed_rows = []
    for idx, row in enumerate(rows):
        parts = [c.strip() for c in row.strip().strip("|").split("|")]
        if idx == 1 and all(re.fullmatch(r":?-{3,}:?", c.replace(" ", "")) for c in parts):
            continue
        parsed_rows.append(parts)

    return parsed_rows, i


def add_table(body, rows: list[list[str]]):
    if not rows:
        return
    max_cols = max(len(r) for r in rows)

    tbl = SubElement(body, w("tbl"))

    tbl_pr = SubElement(tbl, w("tblPr"))
    tbl_w = SubElement(tbl_pr, w("tblW"))
    tbl_w.set(w("type"), "auto")
    tbl_w.set(w("w"), "0")

    tbl_borders = SubElement(tbl_pr, w("tblBorders"))
    for b in ["top", "left", "bottom", "right", "insideH", "insideV"]:
        edge = SubElement(tbl_borders, w(b))
        edge.set(w("val"), "single")
        edge.set(w("sz"), "8")
        edge.set(w("space"), "0")
        edge.set(w("color"), "000000")

    tbl_grid = SubElement(tbl, w("tblGrid"))
    for _ in range(max_cols):
        grid_col = SubElement(tbl_grid, w("gridCol"))
        grid_col.set(w("w"), "2400")

    for r_idx, row in enumerate(rows):
        tr = SubElement(tbl, w("tr"))
        cells = row + [""] * (max_cols - len(row))
        for cell_text in cells:
            tc = SubElement(tr, w("tc"))
            tc_pr = SubElement(tc, w("tcPr"))
            tc_w = SubElement(tc_pr, w("tcW"))
            tc_w.set(w("type"), "dxa")
            tc_w.set(w("w"), "2400")

            p = SubElement(tc, w("p"))
            if r_idx == 0:
                add_run(p, cell_text, bold=True)
            else:
                add_run(p, cell_text)


def build_document_xml(markdown_text: str) -> bytes:
    document = Element(w("document"), {
        "xmlns:w": W_NS,
        "xmlns:r": R_NS,
    })
    body = SubElement(document, w("body"))

    lines = markdown_text.splitlines()
    i = 0
    in_code = False

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if stripped.startswith("```"):
            # Preserve code fence lines as part of code block text
            add_code_paragraph(body, stripped)
            in_code = not in_code
            i += 1
            continue

        if in_code:
            add_code_paragraph(body, line)
            i += 1
            continue

        if not stripped:
            add_paragraph(body, "")
            i += 1
            continue

        if stripped.startswith("## "):
            add_paragraph(body, stripped[3:].strip(), style="Heading1")
            i += 1
            continue

        if stripped.startswith("### "):
            add_paragraph(body, stripped[4:].strip(), style="Heading2")
            i += 1
            continue

        # Markdown table
        if stripped.startswith("|"):
            table, next_idx = parse_table(lines, i)
            if table:
                add_table(body, table)
                i = next_idx
                continue

        # Ordered list line
        if re.match(r"^\d+\.\s+", stripped):
            # Keep numbering text but render subsection lines in bold for better hierarchy.
            add_paragraph(body, stripped, bold=True)
            i += 1
            continue

        # Bullet list line
        if stripped.startswith("- "):
            # Render bullets with visible dot marker instead of markdown hyphen.
            add_paragraph(body, f"• {stripped[2:].strip()}")
            i += 1
            continue

        # Inline subsection labels that should be emphasized.
        if stripped.startswith("HLD Mapping:") or stripped.startswith("Evidence:"):
            add_paragraph(body, line, bold=True)
            i += 1
            continue

        if stripped.endswith(":") and len(stripped) <= 80:
            add_paragraph(body, line, bold=True)
            i += 1
            continue

        # Plain paragraph
        add_paragraph(body, line)
        i += 1

    # Section properties
    sect_pr = SubElement(body, w("sectPr"))
    pg_sz = SubElement(sect_pr, w("pgSz"))
    pg_sz.set(w("w"), "12240")
    pg_sz.set(w("h"), "15840")
    pg_mar = SubElement(sect_pr, w("pgMar"))
    pg_mar.set(w("top"), "1440")
    pg_mar.set(w("right"), "1440")
    pg_mar.set(w("bottom"), "1440")
    pg_mar.set(w("left"), "1440")
    pg_mar.set(w("header"), "708")
    pg_mar.set(w("footer"), "708")
    pg_mar.set(w("gutter"), "0")

    return tostring(document, encoding="utf-8", xml_declaration=True)


def build_styles_xml() -> bytes:
    styles = Element(w("styles"), {"xmlns:w": W_NS})

    def style(style_id: str, name: str, based_on: str | None = None, next_style: str | None = None, ui_priority: str | None = None, qformat: bool = False, is_default: bool = False, run_size: int | None = None, bold: bool = False, code: bool = False):
        s = SubElement(styles, w("style"))
        s.set(w("type"), "paragraph")
        s.set(w("styleId"), style_id)
        if is_default:
            s.set(w("default"), "1")
        SubElement(s, w("name")).set(w("val"), name)
        if based_on:
            SubElement(s, w("basedOn")).set(w("val"), based_on)
        if next_style:
            SubElement(s, w("next")).set(w("val"), next_style)
        if ui_priority:
            SubElement(s, w("uiPriority")).set(w("val"), ui_priority)
        if qformat:
            SubElement(s, w("qFormat"))
        rpr = SubElement(s, w("rPr"))
        if bold:
            SubElement(rpr, w("b"))
        if code:
            rfonts = SubElement(rpr, w("rFonts"))
            rfonts.set(w("ascii"), "Consolas")
            rfonts.set(w("hAnsi"), "Consolas")
            rfonts.set(w("cs"), "Consolas")
        if run_size is not None:
            SubElement(rpr, w("sz")).set(w("val"), str(run_size))
            SubElement(rpr, w("szCs")).set(w("val"), str(run_size))

    style("Normal", "Normal", next_style="Normal", is_default=True, run_size=22)
    style("Heading1", "heading 1", based_on="Normal", next_style="Normal", ui_priority="9", qformat=True, run_size=32, bold=True)
    style("Heading2", "heading 2", based_on="Normal", next_style="Normal", ui_priority="9", qformat=True, run_size=28, bold=True)
    style("Code", "Code", based_on="Normal", next_style="Code", run_size=20, code=True)

    return tostring(styles, encoding="utf-8", xml_declaration=True)


def build_content_types_xml() -> bytes:
    xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"""
    return xml.encode("utf-8")


def build_root_rels_xml() -> bytes:
    xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"""
    return xml.encode("utf-8")


def build_document_rels_xml() -> bytes:
    xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
"""
    return xml.encode("utf-8")


def build_core_xml() -> bytes:
    now = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="{CP_NS}" xmlns:dc="{DC_NS}" xmlns:dcterms="{DCTERMS_NS}" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="{XSI_NS}">
  <dc:title>LLD 3.1 Agent Orchestration Core</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>
</cp:coreProperties>
"""
    return xml.encode("utf-8")


def build_app_xml() -> bytes:
    xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Codex</Application>
</Properties>
"""
    return xml.encode("utf-8")


def markdown_to_docx(markdown_path: Path, output_docx: Path):
    md_text = markdown_path.read_text(encoding="utf-8")
    document_xml = build_document_xml(md_text)
    styles_xml = build_styles_xml()

    output_docx.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output_docx, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", build_content_types_xml())
        zf.writestr("_rels/.rels", build_root_rels_xml())
        zf.writestr("word/document.xml", document_xml)
        zf.writestr("word/styles.xml", styles_xml)
        zf.writestr("word/_rels/document.xml.rels", build_document_rels_xml())
        zf.writestr("docProps/core.xml", build_core_xml())
        zf.writestr("docProps/app.xml", build_app_xml())


if __name__ == "__main__":
    import sys
    if len(sys.argv) != 3:
        print("Usage: markdown_to_docx_simple.py <input.md> <output.docx>")
        raise SystemExit(1)
    markdown_to_docx(Path(sys.argv[1]), Path(sys.argv[2]))
