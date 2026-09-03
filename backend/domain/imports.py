"""Safe CSV/XLSX parsing and normalization for operational imports."""

from __future__ import annotations

import csv
import io
import re
import unicodedata
import zipfile
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import PurePath
from typing import Any
from xml.etree import ElementTree


MAX_FILE_BYTES = 4 * 1024 * 1024
MAX_UNCOMPRESSED_BYTES = 16 * 1024 * 1024
MAX_ROWS = 5_000
MAX_COLUMNS = 50
MAX_CELL_LENGTH = 2_000

_HEADER_ALIASES = {
    "nome": "nome",
    "name": "nome",
    "email": "email",
    "e_mail": "email",
    "telefone": "telefone",
    "celular": "telefone",
    "whatsapp": "telefone",
    "categoria": "categoria",
    "category": "categoria",
    "descricao": "descricao",
    "description": "descricao",
    "preco": "preco",
    "valor": "preco",
    "price": "preco",
    "duracao": "duracao_min",
    "duracao_min": "duracao_min",
    "duracao_minutos": "duracao_min",
    "ativo": "ativo",
    "publico": "publico",
}


@dataclass(frozen=True)
class ParsedImport:
    headers: list[str]
    rows: list[dict[str, str]]
    format: str


def _slug(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.strip().lower())
    ascii_value = "".join(char for char in normalized if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", "_", ascii_value).strip("_")


def _normalize_headers(values: list[str]) -> list[str]:
    result: list[str] = []
    used: set[str] = set()
    for index, raw in enumerate(values):
        candidate = _HEADER_ALIASES.get(_slug(raw), _slug(raw)) or f"coluna_{index + 1}"
        if candidate in used:
            raise ValueError(f"A coluna {candidate!r} aparece mais de uma vez.")
        used.add(candidate)
        result.append(candidate)
    return result


def spreadsheet_formula_risk(value: str) -> bool:
    """Detect cells that spreadsheet programs could evaluate as formulas.

    Signed phone numbers and signed numeric values remain valid; formulas and
    command-like content beginning with ``=``, ``@``, tab or carriage return do
    not.
    """

    stripped = value.lstrip(" ")
    if not stripped:
        return False
    if stripped[0] in "=@\t\r":
        return True
    if stripped[0] in "+-":
        return re.fullmatch(r"[+-][0-9()., /-]+", stripped) is None
    return False


def _rows_from_matrix(matrix: list[list[str]], *, source_format: str) -> ParsedImport:
    if not matrix:
        raise ValueError("O arquivo está vazio.")
    if len(matrix) - 1 > MAX_ROWS:
        raise ValueError(f"Envie no máximo {MAX_ROWS} linhas por importação.")
    if len(matrix[0]) > MAX_COLUMNS:
        raise ValueError(f"Envie no máximo {MAX_COLUMNS} colunas por importação.")
    headers = _normalize_headers([str(item) for item in matrix[0]])
    rows: list[dict[str, str]] = []
    for values in matrix[1:]:
        if not any(str(value).strip() for value in values):
            continue
        row: dict[str, str] = {}
        for index, header in enumerate(headers):
            value = str(values[index] if index < len(values) else "").strip()
            if len(value) > MAX_CELL_LENGTH:
                raise ValueError(f"A coluna {header!r} ultrapassa {MAX_CELL_LENGTH} caracteres.")
            row[header] = value
        rows.append(row)
    if not rows:
        raise ValueError("O arquivo não possui linhas de dados.")
    return ParsedImport(headers=headers, rows=rows, format=source_format)


def _parse_csv(content: bytes) -> ParsedImport:
    text: str | None = None
    for encoding in ("utf-8-sig", "utf-8", "cp1252"):
        try:
            text = content.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        raise ValueError("O CSV precisa usar UTF-8 ou Windows-1252.")
    sample = text[:8_192]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
        dialect.delimiter = ";"
    matrix = [list(row) for row in csv.reader(io.StringIO(text), dialect)]
    return _rows_from_matrix(matrix, source_format="csv")


def _column_index(reference: str) -> int:
    letters = "".join(char for char in reference if char.isalpha()).upper()
    result = 0
    for char in letters:
        result = result * 26 + ord(char) - ord("A") + 1
    return max(result - 1, 0)


def _parse_xlsx(content: bytes) -> ParsedImport:
    try:
        archive = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile as exc:
        raise ValueError("O arquivo XLSX está inválido ou corrompido.") from exc
    with archive:
        infos = archive.infolist()
        if len(infos) > 500 or sum(item.file_size for item in infos) > MAX_UNCOMPRESSED_BYTES:
            raise ValueError("O XLSX descompactado ultrapassa o limite de segurança.")
        names = {item.filename for item in infos}
        worksheet = next(
            (name for name in sorted(names) if name.startswith("xl/worksheets/sheet") and name.endswith(".xml")),
            None,
        )
        if not worksheet:
            raise ValueError("O XLSX não possui uma planilha legível.")
        shared: list[str] = []
        if "xl/sharedStrings.xml" in names:
            root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("{*}si"):
                shared.append("".join(node.text or "" for node in item.iterfind(".//{*}t")))
        root = ElementTree.fromstring(archive.read(worksheet))
        matrix: list[list[str]] = []
        for row_node in root.findall(".//{*}sheetData/{*}row"):
            values: list[str] = []
            for cell in row_node.findall("{*}c"):
                index = _column_index(cell.attrib.get("r", "A1"))
                if index >= MAX_COLUMNS:
                    raise ValueError(f"Envie no máximo {MAX_COLUMNS} colunas por importação.")
                while len(values) <= index:
                    values.append("")
                if cell.find("{*}f") is not None:
                    value = "=" + (cell.findtext("{*}f") or "")
                elif cell.attrib.get("t") == "inlineStr":
                    value = "".join(node.text or "" for node in cell.iterfind(".//{*}t"))
                else:
                    value = cell.findtext("{*}v") or ""
                    if cell.attrib.get("t") == "s" and value.isdigit():
                        shared_index = int(value)
                        value = shared[shared_index] if shared_index < len(shared) else ""
                values[index] = value
            matrix.append(values)
            if len(matrix) > MAX_ROWS + 1:
                raise ValueError(f"Envie no máximo {MAX_ROWS} linhas por importação.")
        return _rows_from_matrix(matrix, source_format="xlsx")


def parse_import_file(filename: str, content: bytes) -> ParsedImport:
    if not content:
        raise ValueError("O arquivo está vazio.")
    if len(content) > MAX_FILE_BYTES:
        raise ValueError("O arquivo ultrapassa o limite de 4 MB.")
    suffix = PurePath(filename).suffix.lower()
    if suffix == ".csv":
        return _parse_csv(content)
    if suffix == ".xlsx":
        return _parse_xlsx(content)
    raise ValueError("Use um arquivo CSV ou XLSX.")


def normalize_import_rows(kind: str, rows: list[dict[str, str]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Validate rows and mark duplicate keys without silently overwriting."""

    if kind not in {"clientes", "servicos"}:
        raise ValueError("O tipo da importação deve ser clientes ou serviços.")
    valid: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    seen: set[str] = set()
    for line_number, original in enumerate(rows, start=2):
        row = {key: value.strip() for key, value in original.items()}
        errors: list[str] = []
        for field, value in row.items():
            if spreadsheet_formula_risk(value):
                errors.append(f"{field}: conteúdo iniciado como fórmula não é permitido")
        name = row.get("nome", "").strip()
        if len(name) < 2:
            errors.append("nome: informe pelo menos 2 caracteres")
        if kind == "clientes":
            email = row.get("email", "").lower()
            phone = re.sub(r"\D", "", row.get("telefone", ""))
            if email and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
                errors.append("email: formato inválido")
            if not email and not phone:
                errors.append("informe e-mail ou telefone para identificar o cliente")
            duplicate_key = f"email:{email}" if email else f"telefone:{phone}"
            normalized = {"nome": name, "email": email or None, "telefone": phone or None}
        else:
            try:
                price = Decimal(row.get("preco", "").replace("R$", "").replace(" ", "").replace(",", "."))
                if price < 0 or price > Decimal("1000000"):
                    raise InvalidOperation
            except (InvalidOperation, ValueError):
                price = Decimal("0")
                errors.append("preco: informe um valor entre 0 e 1.000.000")
            try:
                duration = int(row.get("duracao_min", ""))
                if not 5 <= duration <= 480:
                    raise ValueError
            except ValueError:
                duration = 0
                errors.append("duracao_min: informe minutos entre 5 e 480")
            category = row.get("categoria", "Serviço") or "Serviço"
            duplicate_key = f"servico:{_slug(name)}:{_slug(category)}"
            normalized = {
                "nome": name,
                "categoria": category,
                "descricao": row.get("descricao", ""),
                "preco": str(price),
                "duracao_min": duration,
            }
        if duplicate_key in seen:
            errors.append("linha duplicada dentro do arquivo")
        seen.add(duplicate_key)
        item = {"linha": line_number, "dados": normalized, "erros": errors}
        (rejected if errors else valid).append(item)
    return valid, rejected
