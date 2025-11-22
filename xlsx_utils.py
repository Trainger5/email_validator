import io
import re
import zipfile
import xml.etree.ElementTree as ET
from typing import List

NS = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def parse_xlsx_rows(data: bytes) -> List[List[str]]:
    """Parse a simple XLSX (first sheet) into rows of strings without external deps."""
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except Exception:
        return []

    sheet_name = None
    for name in zf.namelist():
        if name.startswith("xl/worksheets/sheet") and name.endswith(".xml"):
            sheet_name = name
            break
    if not sheet_name:
        return []

    shared_strings: List[str] = []
    if "xl/sharedStrings.xml" in zf.namelist():
        try:
            shared_root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for node in shared_root.findall(".//main:t", NS):
                shared_strings.append(node.text or "")
        except Exception:
            shared_strings = []

    try:
        sheet_root = ET.fromstring(zf.read(sheet_name))
    except Exception:
        return []

    rows: List[List[str]] = []
    for row in sheet_root.findall(".//main:sheetData/main:row", NS):
        cells = {}
        max_idx = -1
        for cell in row.findall("main:c", NS):
            ref = cell.get("r", "")
            col_letters = re.sub(r"[0-9]", "", ref) or "A"
            idx = _col_to_index(col_letters)
            if idx > max_idx:
                max_idx = idx
            cell_type = cell.get("t")
            v = cell.find("main:v", NS)
            text = ""
            if v is not None and v.text is not None:
                raw = v.text
                if cell_type == "s":
                    try:
                        pos = int(raw)
                        text = shared_strings[pos] if pos < len(shared_strings) else raw
                    except Exception:
                        text = raw
                else:
                    text = raw
            cells[idx] = text
        if max_idx >= 0:
            row_vals = [cells.get(i, "") for i in range(max_idx + 1)]
        else:
            row_vals = []
        rows.append(row_vals)
    return rows


def build_template_xlsx(headers: List[str]) -> bytes:
    """Create a minimal XLSX file in-memory containing the header row."""
    buf = io.BytesIO()
    # create workbook
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "[Content_Types].xml",
            _content_types(),
        )
        zf.writestr(
            "_rels/.rels",
            _root_rels(),
        )
        zf.writestr(
            "xl/_rels/workbook.xml.rels",
            _workbook_rels(),
        )
        zf.writestr(
            "xl/workbook.xml",
            _workbook_xml(),
        )

        shared = _shared_strings(headers)
        zf.writestr("xl/sharedStrings.xml", shared)
        zf.writestr("xl/styles.xml", _styles_xml())
        sheet_xml = _sheet_with_headers(headers)
        zf.writestr("xl/worksheets/sheet1.xml", sheet_xml)
    return buf.getvalue()


def _col_to_index(col: str) -> int:
    col = col.upper()
    idx = 0
    for ch in col:
        idx = idx * 26 + (ord(ch) - ord("A") + 1)
    return max(idx - 1, 0)


def _index_to_col(idx: int) -> str:
    idx += 1
    letters = ""
    while idx:
        idx, rem = divmod(idx - 1, 26)
        letters = chr(65 + rem) + letters
    return letters


def _sheet_with_headers(headers: List[str]) -> str:
    cells = []
    for i, header in enumerate(headers):
        coord = f"{_index_to_col(i)}1"
        cells.append(f'<c r="{coord}" t="s"><v>{i}</v></c>')
    joined = "".join(cells)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f"<sheetData><row r=\"1\">{joined}</row></sheetData>"
        "</worksheet>"
    )


def _shared_strings(headers: List[str]) -> str:
    items = "".join(f"<si><t>{_escape_xml(h)}</t></si>" for h in headers)
    count = len(headers)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        f'count="{count}" uniqueCount="{count}">{items}</sst>'
    )


def _workbook_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets><sheet name="Validations" sheetId="1" r:id="rId1"/></sheets>'
        "</workbook>"
    )


def _workbook_rels() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
        'Target="worksheets/sheet1.xml"/>'
        '<Relationship Id="rId2" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" '
        'Target="sharedStrings.xml"/>'
        '<Relationship Id="rId3" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" '
        'Target="styles.xml"/>'
        "</Relationships>"
    )


def _root_rels() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="xl/workbook.xml"/>'
        "</Relationships>"
    )


def _styles_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        "<fonts count=\"1\"><font><sz val=\"11\"/><color theme=\"1\"/><name val=\"Calibri\"/><family val=\"2\"/></font></fonts>"
        "<fills count=\"1\"><fill><patternFill patternType=\"none\"/></fill></fills>"
        "<borders count=\"1\"><border/></borders>"
        "<cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>"
        "<cellXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/></cellXfs>"
        "</styleSheet>"
    )


def _content_types() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        "</Types>"
    )


def _escape_xml(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )
