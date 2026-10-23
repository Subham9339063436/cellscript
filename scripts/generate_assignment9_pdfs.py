#!/usr/bin/env python3
"""Generate Assignment 9 (Review 2) and a source-code listing for CellScript."""
from pathlib import Path
from datetime import date
import textwrap
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    Preformatted, Flowable, KeepTogether
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output"
OUT.mkdir(exist_ok=True)
REPORT_PDF = OUT / "CellScript_Assignment_9_Review_2.pdf"
SOURCE_PDF = OUT / "CellScript_Main_Source_Code.pdf"
TODAY = date.today().strftime("%d %B %Y")

GREEN = colors.HexColor("#176B4D")
GREEN2 = colors.HexColor("#2B8A62")
DARK = colors.HexColor("#172B26")
INK = colors.HexColor("#24332E")
MUTED = colors.HexColor("#64756E")
PALE = colors.HexColor("#EAF5EF")
PALE2 = colors.HexColor("#F4F8F5")
BORDER = colors.HexColor("#D6E2DA")
BLUE = colors.HexColor("#325D8A")
WHITE = colors.white

# Use bundled OS fonts when available, with standard PDF fonts as fallback.
font_dir = Path("/usr/share/fonts/truetype/dejavu")
try:
    pdfmetrics.registerFont(TTFont("DV", str(font_dir / "DejaVuSans.ttf")))
    pdfmetrics.registerFont(TTFont("DV-Bold", str(font_dir / "DejaVuSans-Bold.ttf")))
    pdfmetrics.registerFont(TTFont("DVM", str(font_dir / "DejaVuSansMono.ttf")))
    FONT, BOLD, MONO = "DV", "DV-Bold", "DVM"
except Exception:
    FONT, BOLD, MONO = "Helvetica", "Helvetica-Bold", "Courier"

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="CoverKicker", fontName=BOLD, fontSize=10, leading=14,
    textColor=GREEN, spaceAfter=10, alignment=TA_LEFT, tracking=1.2
))
styles.add(ParagraphStyle(
    name="CoverTitle", fontName=BOLD, fontSize=31, leading=36,
    textColor=DARK, spaceAfter=9
))
styles.add(ParagraphStyle(
    name="CoverSub", fontName=FONT, fontSize=14, leading=20,
    textColor=MUTED, spaceAfter=16
))
styles.add(ParagraphStyle(
    name="Section", fontName=BOLD, fontSize=17, leading=21,
    textColor=DARK, spaceBefore=5, spaceAfter=9, keepWithNext=True
))
styles.add(ParagraphStyle(
    name="Subsection", fontName=BOLD, fontSize=11.2, leading=14.5,
    textColor=GREEN, spaceBefore=8, spaceAfter=4, keepWithNext=True
))
styles.add(ParagraphStyle(
    name="Body2", fontName=FONT, fontSize=9.0, leading=13,
    textColor=INK, spaceAfter=6
))
styles.add(ParagraphStyle(
    name="Small", fontName=FONT, fontSize=7.8, leading=10.5,
    textColor=MUTED, spaceAfter=4
))
styles.add(ParagraphStyle(
    name="Bullet2", fontName=FONT, fontSize=8.7, leading=12.1,
    textColor=INK, leftIndent=12, firstLineIndent=-7, bulletIndent=0,
    spaceAfter=3
))
styles.add(ParagraphStyle(
    name="TableHead", fontName=BOLD, fontSize=8.2, leading=10,
    textColor=WHITE
))
styles.add(ParagraphStyle(
    name="TableCell", fontName=FONT, fontSize=7.7, leading=10,
    textColor=INK
))
styles.add(ParagraphStyle(
    name="TableCellBold", fontName=BOLD, fontSize=7.7, leading=10,
    textColor=DARK
))
styles.add(ParagraphStyle(
    name="CodeBlockStyle", fontName=MONO, fontSize=5.8, leading=7.1,
    textColor=colors.HexColor("#1F322B"), leftIndent=0, rightIndent=0,
    spaceAfter=0, splitLongWords=1
))
styles.add(ParagraphStyle(
    name="CodeIntro", fontName=FONT, fontSize=8.7, leading=12.5,
    textColor=INK, spaceAfter=7
))
styles.add(ParagraphStyle(
    name="SourcePath", fontName=BOLD, fontSize=13, leading=16,
    textColor=DARK, spaceAfter=4
))
styles.add(ParagraphStyle(
    name="SourceMeta", fontName=FONT, fontSize=7.5, leading=10,
    textColor=MUTED, spaceAfter=8
))
styles.add(ParagraphStyle(
    name="Centered", fontName=FONT, fontSize=8.7, leading=12,
    textColor=MUTED, alignment=TA_CENTER
))

def P(text, style="Body2"):
    return Paragraph(text, styles[style])

def bullet(text):
    return Paragraph("&bull; " + text, styles["Bullet2"])

def cell(text, style="TableCell"):
    return Paragraph(text, styles[style])

def make_table(rows, widths, header=True, repeatRows=1, padd=6):
    t = Table(rows, colWidths=widths, repeatRows=(repeatRows if header else 0), hAlign="LEFT")
    ts = [
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), padd),
        ("RIGHTPADDING", (0,0), (-1,-1), padd),
        ("TOPPADDING", (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("GRID", (0,0), (-1,-1), 0.35, BORDER),
    ]
    if header:
        ts += [
            ("BACKGROUND", (0,0), (-1,0), GREEN),
            ("TEXTCOLOR", (0,0), (-1,0), WHITE),
        ]
        if len(rows) > 1:
            ts += [("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, PALE2])]
    else:
        ts += [("ROWBACKGROUNDS", (0,0), (-1,-1), [WHITE, PALE2])]
    t.setStyle(TableStyle(ts))
    return t

def draw_cover(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(colors.HexColor("#F5FAF7"))
    canvas.rect(0, 0, w, h, stroke=0, fill=1)
    canvas.setFillColor(GREEN)
    canvas.rect(0, h-15*mm, w, 15*mm, stroke=0, fill=1)
    canvas.setFillColor(GREEN2)
    canvas.rect(0, 0, 10*mm, h, stroke=0, fill=1)
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(1)
    canvas.line(25*mm, 25*mm, w-20*mm, 25*mm)
    canvas.setFont(FONT, 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(25*mm, 16*mm, "CELLSCRIPT  |  ASSIGNMENT 9  |  REVIEW 2")
    canvas.drawRightString(w-20*mm, 16*mm, TODAY)
    canvas.restoreState()

def draw_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(GREEN)
    canvas.rect(0, h-10*mm, w, 10*mm, stroke=0, fill=1)
    canvas.setFont(BOLD, 7.3)
    canvas.setFillColor(WHITE)
    canvas.drawString(18*mm, h-6.5*mm, "CELLSCRIPT  /  SECOND REVIEW")
    canvas.setStrokeColor(BORDER)
    canvas.line(18*mm, 14*mm, w-18*mm, 14*mm)
    canvas.setFont(FONT, 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(18*mm, 8.5*mm, "VIT Vellore | Compiler Design (BCSE307L)")
    canvas.drawRightString(w-18*mm, 8.5*mm, f"Page {doc.page}")
    canvas.restoreState()

class PipelineDiagram(Flowable):
    def __init__(self, width=174*mm, height=29*mm):
        super().__init__()
        self.width, self.height = width, height
    def draw(self):
        c = self.canv
        labels = [
            ("Formula", "cell input"),
            ("Lexer", "tokens"),
            ("Parser", "AST"),
            ("Dependency", "graph + cycles"),
            ("Evaluator", "values/errors"),
        ]
        gap = 5
        boxw = (self.width - gap*4) / 5
        boxh = 18*mm
        y = 5*mm
        for i, (title, sub) in enumerate(labels):
            x = i*(boxw+gap)
            c.setFillColor(PALE if i in (1,2,3) else WHITE)
            c.setStrokeColor(GREEN2 if i in (1,2,3) else BORDER)
            c.roundRect(x, y, boxw, boxh, 5, fill=1, stroke=1)
            c.setFillColor(DARK)
            c.setFont(BOLD, 7.2)
            c.drawCentredString(x+boxw/2, y+boxh-6*mm, title)
            c.setFillColor(MUTED)
            c.setFont(FONT, 6)
            c.drawCentredString(x+boxw/2, y+4*mm, sub)
            if i < len(labels)-1:
                c.setStrokeColor(GREEN2)
                c.setLineWidth(1)
                ax = x + boxw
                c.line(ax+0.5, y+boxh/2, ax+gap-1.4, y+boxh/2)
                c.line(ax+gap-3.3, y+boxh/2+1.6, ax+gap-1.4, y+boxh/2)
                c.line(ax+gap-3.3, y+boxh/2-1.6, ax+gap-1.4, y+boxh/2)

def build_review_pdf():
    doc = SimpleDocTemplate(
        str(REPORT_PDF), pagesize=A4,
        rightMargin=18*mm, leftMargin=18*mm,
        topMargin=17*mm, bottomMargin=19*mm,
        title="CellScript - Assignment 9 Second Review",
        author="Subham Hazra",
        subject="Compiler Design Phase 2 project review"
    )
    story = []

    # Cover
    story += [
        Spacer(1, 28*mm),
        P("PROJECT REVIEW  /  ASSIGNMENT 9", "CoverKicker"),
        P("CellScript", "CoverTitle"),
        P("Spreadsheet Formula Compiler and Interactive Compiler Workbench", "CoverSub"),
        Spacer(1, 4*mm),
        Table([[""]], colWidths=[174*mm], rowHeights=[2.5*mm], style=TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), GREEN2),
        ])),
        Spacer(1, 12*mm),
        P("SECOND REVIEW COPY", "Section"),
        P("Phase 2 implementation report covering the spreadsheet interface, formula-language pipeline, dependency analysis, evaluation, API design, tests, and deployment.", "Body2"),
        Spacer(1, 8*mm),
    ]
    details = [
        [cell("INSTITUTION", "TableCellBold"), cell("Vellore Institute of Technology (VIT), Vellore")],
        [cell("COURSE", "TableCellBold"), cell("Compiler Design (BCSE307L)")],
        [cell("SUBMITTED BY", "TableCellBold"), cell("Subham Hazra")],
        [cell("REGISTRATION NO.", "TableCellBold"), cell("24BKT0111")],
        [cell("REVIEW", "TableCellBold"), cell("Second Review / Assignment 9")],
        [cell("DATE", "TableCellBold"), cell(TODAY)],
    ]
    story.append(make_table(details, [43*mm, 131*mm], header=False, padd=9))
    story += [
        Spacer(1, 12*mm),
        P("<b>Live application:</b> <link href='https://cellscript.vercel.app' color='#176B4D'>cellscript.vercel.app</link>", "Body2"),
        P("<b>GitHub repository:</b> <link href='https://github.com/Subham9339063436/cellscript' color='#176B4D'>github.com/Subham9339063436/cellscript</link>", "Body2"),
        P("<b>Purpose:</b> demonstrate and document the project's current Phase 2 implementation for the second project review.", "Small"),
        PageBreak(),
    ]

    # Executive summary and objectives
    story += [
        P("1. Executive Summary", "Section"),
        P("CellScript is a spreadsheet-style formula compiler and evaluator developed for the Compiler Design project. It combines a C++17 lexer, recursive-descent parser, abstract syntax tree (AST), dependency analysis, circular-reference detection, and dependency-aware evaluation with a React/TypeScript spreadsheet dashboard. A local native HTTP API supports development, while a TypeScript implementation is exposed through Vercel serverless routes for the hosted application.", "Body2"),
        P("The user interface includes a spreadsheet grid and formula bar, along with a Compiler workbench that presents lexical analysis, a graphical AST, dependency resolution, and evaluation results for the selected cell. The Phase 2 code and documentation are in the GitHub main branch, and the hosted evaluator has a successful live diagnostic run.", "Body2"),
        P("1.1 Problem Statement", "Subsection"),
        P("A spreadsheet formula needs more than arithmetic execution: the system must recognize tokens, parse expressions according to precedence, represent expression structure, identify referenced cells, order dependent formulas, and detect invalid or circular computations. CellScript provides a small end-to-end implementation of these steps with visual feedback.", "Body2"),
        P("1.2 Objectives", "Subsection"),
        bullet("Implement a formula lexer and recursive-descent parser that generates an AST."),
        bullet("Support cell references, ranges, arithmetic operators, and selected aggregate functions."),
        bullet("Build dependency information and evaluate formulas in dependency-first order."),
        bullet("Report circular references and common formula errors."),
        bullet("Connect a spreadsheet interface to compiler/evaluator diagnostics."),
        bullet("Deploy the UI and evaluator API and document repeatable build and test steps."),
        P("1.3 Scope", "Subsection"),
        P("This review covers the working project structure and current implementation. It is a teaching-scale formula language, not a complete replacement for Excel or Google Sheets; support is limited to the operators, references, ranges, and functions documented in the repository.", "Body2"),
        PageBreak(),
    ]

    # Architecture
    story += [
        P("2. System Architecture", "Section"),
        P("The project separates formula processing from the spreadsheet presentation layer. In local development, the React frontend communicates with the native C++ API. The public deployment uses same-origin Vercel routes with a TypeScript evaluator; the hosted site does not depend on a C++ process running on the developer's computer.", "Body2"),
        PipelineDiagram(),
        Spacer(1, 3*mm),
        P("Figure 1. High-level formula processing pipeline.", "Small"),
        P("2.1 Main Components", "Subsection"),
    ]
    rows = [
        [cell("Component", "TableHead"), cell("Role", "TableHead"), cell("Main location", "TableHead")],
        [cell("Lexer"), cell("Recognizes numeric literals, cell references, function names, punctuation and operators."), cell("src/lexer.cpp; frontend/src/lib/evaluator.ts")],
        [cell("Parser and AST"), cell("Parses expressions, respects operator precedence, and structures operators, references, ranges and calls."), cell("src/parser.cpp; src/ast.cpp")],
        [cell("Dependency analysis"), cell("Extracts referenced cells, orders formula dependencies and identifies cycles."), cell("src/evaluator.cpp; frontend/src/lib/evaluator.ts")],
        [cell("Native API"), cell("Provides local JSON health and evaluation routes over HTTP."), cell("src/api_server.cpp")],
        [cell("Web dashboard"), cell("Spreadsheet editing and the Compiler workbench views."), cell("frontend/src/App.tsx")],
        [cell("Hosted API"), cell("Vercel serverless health and evaluation endpoints."), cell("frontend/api/")],
    ]
    story.append(make_table(rows, [30*mm, 91*mm, 53*mm], padd=5))
    story += [
        P("2.2 Deployment Paths", "Subsection"),
        bullet("<b>Local:</b> build the C++ project with Make, start the API on port 8080, then run the Vite frontend."),
        bullet("<b>Hosted:</b> Vercel serves the frontend and TypeScript API routes from the same origin. Production calls use /api/health and /api/evaluate, not localhost."),
        P("Deployment configuration: the Vercel project root is frontend/, build command is npm run build, and output directory is dist.", "Body2"),
        PageBreak(),
    ]

    # Language / grammar
    story += [
        P("3. Formula Language and Compiler Pipeline", "Section"),
        P("3.1 Supported Expressions", "Subsection"),
        P("Examples of accepted formula patterns include =A1+B1, =C9-B9, =SUM(A1:B3), and =SUM(A1:B3)+C2*2. The parser builds an AST that reflects operator structure and child expressions.", "Body2"),
    ]
    grammar = [
        [cell("Feature", "TableHead"), cell("Support in current implementation", "TableHead")],
        [cell("Numeric literals"), cell("Integer and decimal values.")],
        [cell("Cell references"), cell("References such as A1 and AA12.")],
        [cell("Ranges"), cell("Rectangular ranges with either endpoint order, such as A1:B3.")],
        [cell("Operators"), cell("+ , - , * , /, parentheses and unary minus.")],
        [cell("Functions"), cell("SUM, AVG, AVERAGE, MAX, MIN, COUNT.")],
        [cell("Error handling"), cell("Invalid formula, missing direct reference, circular dependency and division by zero.")],
    ]
    story.append(make_table(grammar, [38*mm, 136*mm]))
    story += [
        P("3.2 Compilation Sequence", "Subsection"),
        bullet("<b>Lexical analysis:</b> source text is converted to tokens with kind and source-column information."),
        bullet("<b>Parsing:</b> the recursive-descent parser applies expression precedence and creates a syntax tree."),
        bullet("<b>AST inspection:</b> the Compiler panel displays the root and child nodes as a graphical tree."),
        bullet("<b>Dependency extraction:</b> cell references and ranges are used to discover formula dependencies."),
        bullet("<b>Evaluation:</b> formulas are evaluated after their dependencies; values and errors are returned to the UI."),
        P("3.3 Abstract Syntax Tree", "Subsection"),
        P("For =C9-B9, the AST root is BinaryOp(-), with CellRef(C9) and CellRef(B9) as its two children. The visual tree uses separate styled node cards and connector edges. Function calls, ranges and numeric literals have distinct node styles. This lets reviewers inspect how a formula was parsed, rather than seeing only the final numeric value.", "Body2"),
        PageBreak(),
    ]

    # UI and algorithms
    story += [
        P("4. Interface and Core Algorithms", "Section"),
        P("4.1 Dashboard Features", "Subsection"),
        bullet("Spreadsheet ribbon with File, Home, Insert, Formulas, Data, View and Compiler sections."),
        bullet("Sample stock-details workbook with formula-derived Profit values and summary metrics."),
        bullet("Cell selection/editing, formula bar, keyboard navigation and browser-side workbook persistence."),
        bullet("View controls, undo/redo, CSV export, and a simple chart view."),
        P("4.2 Compiler Workbench", "Subsection"),
    ]
    view_rows = [
        [cell("View", "TableHead"), cell("Information presented", "TableHead")],
        [cell("Lexical analysis"), cell("Token stream, token types and source positions.")],
        [cell("AST parsing"), cell("Graphical AST nodes and parent-child branches.")],
        [cell("Dependency resolution"), cell("Referenced cells and range-derived dependencies.")],
        [cell("Evaluation"), cell("Dependency-first order, computed values and cell-specific errors.")],
    ]
    story.append(make_table(view_rows, [42*mm, 132*mm]))
    story += [
        P("4.3 Dependency Resolution", "Subsection"),
        P("The evaluator extracts dependencies from cell-reference nodes and expands ranges to their cell addresses. Formula cells referenced by another formula must be evaluated first. A depth-first traversal tracks unseen, visiting and complete states; reaching a visiting node indicates a cycle. Completed formula cells are appended after their dependencies, yielding a dependency-first evaluation order.", "Body2"),
        P("4.4 Aggregate Functions and Errors", "Subsection"),
        P("SUM totals populated numeric inputs and returns zero for an empty range. AVG/AVERAGE, MAX and MIN require at least one populated numeric value. COUNT counts populated numeric values. Empty cells in aggregate ranges are ignored, direct references to missing cells are reported as errors, division by zero is reported at cell level, and range expansion is capped at 100,000 cells.", "Body2"),
        PageBreak(),
    ]

    # API and verification
    story += [
        P("5. API, Testing and Verification", "Section"),
        P("5.1 API Endpoints", "Subsection"),
    ]
    api_rows = [
        [cell("Route", "TableHead"), cell("Purpose", "TableHead")],
        [cell("GET /api/health"), cell("Returns a JSON health response for the hosted API.")],
        [cell("POST /api/evaluate"), cell("Accepts workbook formulas and numeric cell values; returns values, errors, evaluation order, tokens, ASTs and dependencies.")],
        [cell("GET /api/evaluate?diagnostic=1"), cell("Runs a smoke check for arithmetic, range functions, AST generation and token generation.")],
    ]
    story.append(make_table(api_rows, [60*mm, 114*mm]))
    story += [
        P("5.2 Automated Checks", "Subsection"),
    ]
    test_rows = [
        [cell("Check", "TableHead"), cell("Observed result", "TableHead"), cell("Evidence", "TableHead")],
        [cell("C++ compiler and native API build"), cell("Passed"), cell("GitHub Actions main workflow")],
        [cell("C++ evaluator and Python/API tests"), cell("Passed"), cell("GitHub Actions main workflow")],
        [cell("React/Vite production build"), cell("Passed"), cell("GitHub Actions main workflow")],
        [cell("Hosted API health"), cell("HTTP 200; status ok"), cell("Live API diagnostic workflow")],
        [cell("Hosted arithmetic"), cell("10 + 20 returned 30"), cell("Live API diagnostic workflow")],
        [cell("Hosted range function"), cell("SUM returned 30"), cell("Live API diagnostic workflow")],
        [cell("Hosted AST and tokens"), cell("Both generated"), cell("Live API diagnostic workflow")],
    ]
    story.append(make_table(test_rows, [48*mm, 54*mm, 72*mm]))
    story += [
        P("The production smoke test ran successfully on 23 October 2026. The hosted test returned HTTP 200 with status ok, arithmetic actual 30 (expected 30), rangeFunction actual 30 (expected 30), astGenerated true, and tokensGenerated true.", "Body2"),
        P("5.3 Verification Boundary", "Subsection"),
        P("The automated smoke test validates the production evaluator and returned diagnostics. It does not replace manual verification of every browser interaction; the spreadsheet rendering, cell editing, graphical AST layout and dependency visualization should still be checked in the live browser.", "Body2"),
        PageBreak(),
    ]

    # Status and future work
    story += [
        P("6. Review Outcome, Limitations and Future Work", "Section"),
        P("6.1 Review Outcome", "Subsection"),
        P("The Phase 2 implementation integrates compiler stages with a spreadsheet-style dashboard, offers views into tokens, AST structure, dependencies and evaluation, and supplies both local and hosted API paths. The main branch includes the implementation, project README, Phase 2 design notes, Vercel deployment guide, and GitHub Actions workflows.", "Body2"),
        P("6.2 Current Limitations", "Subsection"),
        bullet("The formula language intentionally supports a small set of operators and aggregate functions rather than full spreadsheet compatibility."),
        bullet("The native C++ API and hosted TypeScript evaluator are separate implementations; future regression tests should continue to verify equivalent behavior."),
        bullet("The hosted smoke test checks core computation and diagnostic generation but does not automate all UI interactions."),
        bullet("The workbook is stored in browser-side persistence, so that persistence is browser/profile specific rather than a cloud-synced multi-user database."),
        P("6.3 Future Enhancements", "Subsection"),
        bullet("Add end-to-end browser tests for editing formulas, recalculation, cell selection, and all compiler views."),
        bullet("Expand supported spreadsheet functions and improve formula diagnostics and error messages."),
        bullet("Add differential tests comparing native C++ and hosted TypeScript evaluation for the same formula workbook."),
        bullet("Improve accessibility, mobile layout, and visualization controls for larger dependency graphs."),
        bullet("Consider an optional cloud persistence layer if multi-device or multi-user workbooks become a requirement."),
        P("7. Conclusion", "Section"),
        P("CellScript Phase 2 demonstrates an end-to-end formula processing pipeline: lexical analysis, recursive-descent parsing, AST generation, dependency analysis, circular-reference detection and evaluation, presented through an interactive spreadsheet dashboard. Automated builds and tests pass, and the live evaluator smoke test confirms arithmetic, a range function, AST generation and token generation on Vercel. The repository and its documentation are prepared for the second review.", "Body2"),
        P("Project links", "Subsection"),
        P("<b>GitHub:</b> <link href='https://github.com/Subham9339063436/cellscript' color='#176B4D'>github.com/Subham9339063436/cellscript</link>", "Body2"),
        P("<b>Live app:</b> <link href='https://cellscript.vercel.app' color='#176B4D'>cellscript.vercel.app</link>", "Body2"),
        P("<b>Deployment notes:</b> <link href='https://github.com/Subham9339063436/cellscript/blob/main/frontend/VERCEL_DEPLOY.md' color='#176B4D'>frontend/VERCEL_DEPLOY.md</link>", "Body2"),
        P("<b>Live diagnostic log:</b> <link href='https://github.com/Subham9339063436/cellscript/actions/runs/39984436678' color='#176B4D'>GitHub Actions - production evaluator smoke test</link>", "Body2"),
        P("References: project README.md, docs/PHASE2.md, frontend/VERCEL_DEPLOY.md, source tree and GitHub Actions run records in the CellScript repository.", "Small"),
    ]

    doc.build(story, onFirstPage=draw_cover, onLaterPages=draw_page)

SOURCE_FILES = [
    "Makefile",
    ".github/workflows/ci.yml",
    ".github/workflows/live-api-diagnostic.yml",
    "include/ast.h",
    "include/errors.h",
    "include/evaluator.h",
    "include/lexer.h",
    "include/parser.h",
    "src/ast.cpp",
    "src/lexer.cpp",
    "src/parser.cpp",
    "src/evaluator.cpp",
    "src/api_server.cpp",
    "src/main.cpp",
    "tests/test_phase1.py",
    "tests/test_phase2.py",
    "tests/test_evaluator.cpp",
    "tests/test_api.py",
    "frontend/package.json",
    "frontend/tsconfig.json",
    "frontend/vite.config.ts",
    "frontend/vercel.json",
    "frontend/api/health.ts",
    "frontend/api/evaluate.ts",
    "frontend/src/main.tsx",
    "frontend/src/lib/evaluator.ts",
    "frontend/src/App.tsx",
    "frontend/src/styles.css",
]

def draw_source_cover(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(colors.HexColor("#F5FAF7"))
    canvas.rect(0, 0, w, h, stroke=0, fill=1)
    canvas.setFillColor(GREEN)
    canvas.rect(0, h-15*mm, w, 15*mm, stroke=0, fill=1)
    canvas.setFillColor(GREEN2)
    canvas.rect(0, 0, 10*mm, h, stroke=0, fill=1)
    canvas.setFont(BOLD, 9)
    canvas.setFillColor(GREEN)
    canvas.drawString(25*mm, h-37*mm, "ASSIGNMENT 9  /  SOURCE CODE LISTING")
    canvas.setFont(BOLD, 29)
    canvas.setFillColor(DARK)
    canvas.drawString(25*mm, h-57*mm, "CellScript")
    canvas.setFont(FONT, 13)
    canvas.setFillColor(MUTED)
    canvas.drawString(25*mm, h-68*mm, "Main project source code")
    canvas.setFont(FONT, 9)
    canvas.drawString(25*mm, h-88*mm, "Compiler Design (BCSE307L) | Second Review")
    canvas.drawString(25*mm, h-96*mm, "Prepared by Subham Hazra | Reg. No. 24BKT0111")
    canvas.setStrokeColor(BORDER)
    canvas.line(25*mm, 25*mm, w-20*mm, 25*mm)
    canvas.setFont(FONT, 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(25*mm, 16*mm, "Source snapshot: GitHub main branch")
    canvas.drawRightString(w-20*mm, 16*mm, TODAY)
    canvas.restoreState()

def source_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(GREEN)
    canvas.rect(0, h-8*mm, w, 8*mm, stroke=0, fill=1)
    canvas.setFont(BOLD, 7)
    canvas.setFillColor(WHITE)
    canvas.drawString(16*mm, h-5.5*mm, "CELLSCRIPT / MAIN SOURCE CODE")
    canvas.setStrokeColor(BORDER)
    canvas.line(16*mm, 13*mm, w-16*mm, 13*mm)
    canvas.setFont(FONT, 6.8)
    canvas.setFillColor(MUTED)
    canvas.drawString(16*mm, 7.8*mm, "Review 2 / Assignment 9")
    canvas.drawRightString(w-16*mm, 7.8*mm, f"Page {doc.page}")
    canvas.restoreState()

def wrap_code_lines(text, width=130):
    result = []
    for number, original in enumerate(text.splitlines(), start=1):
        line = original.expandtabs(4).rstrip("\r")
        prefix = f"{number:04d}  "
        if not line:
            result.append(prefix.rstrip())
            continue
        wrapped = textwrap.wrap(
            line, width=width, subsequent_indent="      ",
            replace_whitespace=False, drop_whitespace=False,
            break_long_words=True, break_on_hyphens=False
        )
        result.append(prefix + wrapped[0])
        for continuation in wrapped[1:]:
            result.append("      " + continuation)
    if text.endswith("\n"):
        pass
    return result

def build_source_pdf():
    doc = SimpleDocTemplate(
        str(SOURCE_PDF), pagesize=A4,
        rightMargin=15*mm, leftMargin=15*mm,
        topMargin=13*mm, bottomMargin=17*mm,
        title="CellScript Main Source Code - Assignment 9",
        author="Subham Hazra",
        subject="Main source code listing for CellScript Phase 2"
    )
    story = [
        Spacer(1, 2*mm),
        P("Main Source Code", "Section"),
        P("This PDF contains line-numbered listings of the principal project implementation and test files from the repository's main branch. The full project, including any files not listed here, remains available in GitHub.", "CodeIntro"),
        P("<b>Repository:</b> <link href='https://github.com/Subham9339063436/cellscript' color='#176B4D'>github.com/Subham9339063436/cellscript</link>", "CodeIntro"),
        P("<b>Live application:</b> <link href='https://cellscript.vercel.app' color='#176B4D'>cellscript.vercel.app</link>", "CodeIntro"),
        P("Contents", "Subsection"),
    ]
    for item in SOURCE_FILES:
        story.append(P("• " + escape(item), "Small"))
    story.append(PageBreak())

    for item in SOURCE_FILES:
        path = ROOT / item
        if not path.is_file():
            story.append(P("Source file not available in this checkout: " + escape(item), "Body2"))
            story.append(PageBreak())
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        lines = text.splitlines()
        story.append(P(escape(item), "SourcePath"))
        story.append(P(f"{len(lines)} source lines | line numbers are for reference; source contents are otherwise preserved.", "SourceMeta"))
        wrapped = wrap_code_lines(text, width=130)
        # Split large source files into manageable chunks so every page has a stable heading.
        chunk_size = 70
        for start in range(0, len(wrapped), chunk_size):
            if start:
                story.append(P(escape(item) + " (continued)", "SourcePath"))
                story.append(P(f"Source lines continued from the previous page.", "SourceMeta"))
            block = "\n".join(wrapped[start:start+chunk_size])
            story.append(Preformatted(block, styles["CodeBlockStyle"], maxLineLength=145))
        story.append(PageBreak())

    doc.build(story, onFirstPage=draw_source_cover, onLaterPages=source_page)

if __name__ == "__main__":
    build_review_pdf()
    build_source_pdf()
    print(f"Created {REPORT_PDF}")
    print(f"Created {SOURCE_PDF}")
