"""Rebuild the six-slide English PDF. Requires reportlab; no browser or keys."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public' / 'airlock-pitch-deck.pdf'
W, H = 960, 540
BG, NAVY, BLUE, MUTED, BORDER = map(colors.HexColor, ['#f5f7fb', '#182b49', '#315ee8', '#617795', '#dce3ed'])
font_dir = Path('C:/Windows/Fonts')
if (font_dir / 'segoeui.ttf').exists() and (font_dir / 'segoeuib.ttf').exists():
    pdfmetrics.registerFont(TTFont('Airlock', str(font_dir / 'segoeui.ttf')))
    pdfmetrics.registerFont(TTFont('AirlockBold', str(font_dir / 'segoeuib.ttf')))
    REG, BOLD = 'Airlock', 'AirlockBold'
else:
    REG, BOLD = 'Helvetica', 'Helvetica-Bold'

c = canvas.Canvas(str(OUTPUT), pagesize=(W, H), pageCompression=1)
c.setTitle('Airlock - Treasury controls for cross-chain payouts')
c.setAuthor('MaksSay and Kuznets')
c.setSubject('Portaldot V3 prototype, recorded testnet evidence and proposed business model')

def text(value, x, y, size=18, bold=False, color=NAVY):
    c.setFillColor(color)
    c.setFont(BOLD if bold else REG, size)
    c.drawString(x, y, value)

def para(value, x, top, width, size=18, color=MUTED, bold=False, leading=None):
    style = ParagraphStyle('body', fontName=BOLD if bold else REG, fontSize=size,
                           leading=leading or size * 1.42, textColor=color)
    p = Paragraph(value, style)
    _, height = p.wrap(width, H)
    if top - height < 30:
        raise ValueError('Text leaves the slide: ' + value)
    p.drawOn(c, x, top-height)
    return top-height

def slide(title=None):
    c.setFillColor(BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    if title:
        para(title, 62, 490, 840, 28, NAVY, True, 35)

def line(y, start=62, end=898):
    c.setStrokeColor(BORDER)
    c.setLineWidth(1)
    c.line(start, y, end, y)

def link(label, url, x, y, size=13):
    text(label, x, y, size, color=BLUE)
    c.linkURL(url, (x, y-4, x+pdfmetrics.stringWidth(label, REG, size), y+size+3), relative=0)

slide()
text('airlock.', 62, 390, 58, True)
para('Treasury controls for<br/>cross-chain payouts', 64, 342, 520, 29, BLUE, leading=39)
text('Built on Portaldot V3', 64, 164, 17)
text('MaksSay and Kuznets', 64, 100, 15, color=MUTED)
logo = Image.open(ROOT / 'public' / 'airlock-logo.png').convert('RGB')
logo.thumbnail((630, 630), Image.Resampling.LANCZOS)
c.drawImage(ImageReader(logo), 668, 150, 210, 210)
c.showPage()

slide('Relay authority needs payout limits')
para('A valid relay instruction can still<br/>request an unwanted payout.', 62, 394, 760, 29, BLUE, leading=40)
text('Who needs this', 62, 238, 18, True)
para('Teams already automating treasury payouts and accepting instructions from other networks.', 62, 210, 760, 20)
para('Airlock adds enforceable spending rules and an independent way to intervene.', 62, 93, 820, 17, NAVY)
c.showPage()

slide('Payout rules execute on Portaldot V3')
for y, number, title, body in [
    (364, '01', 'Spending budget', 'The contract caps cumulative releases and preserves a reserve floor.'),
    (255, '02', 'Quarantine', 'Larger requests wait. Funds remain reserved inside the treasury.'),
    (146, '03', 'Guardian control', 'A separate guardian can pause releases or cancel queued requests.')]:
    text(number+'  '+title, 62, y, 20, True, BLUE)
    para(body, 62, y-22, 820, 18)
c.showPage()

slide('Real requests and recorded results')
text('0.25 tPOT', 62, 359, 41, True, BLUE)
para('Paid in an earlier Sepolia-to-V3 testnet run', 62, 330, 760, 18)
line(280)
text('4 tPOT request', 62, 231, 28, True)
para('Quarantined, paused and cancelled', 62, 207, 540, 20)
text('0 tPOT', 665, 231, 36, True, BLUE)
para('Paid during that<br/>controlled scenario', 667, 208, 220, 17)
para('Treasury after the controlled run: 48.75 tPOT', 62, 132, 820, 18, NAVY)
link('Inspect the recorded V3 receipts', 'https://github.com/Makssay/AirLock/blob/main/artifacts/v3-attack-demo.json', 62, 66, 14)
c.showPage()

slide('Portaldot holds the treasury and the rules')
text('Sepolia supplies the instruction', 62, 380, 19, True, BLUE)
para('An outbox emits a payout request. The trusted RPC relay checks it after six canonical confirmations.', 62, 352, 380, 18)
text('V3 enforces the payout', 505, 380, 19, True, BLUE)
para('The Solidity contract runs through Revive. The treasury holds tPOT. The guardian signs native Substrate calls.', 505, 352, 390, 18)
line(239)
text('Live testnet operator run', 62, 200, 19, True)
para('Connected wallets and real chain state', 62, 176, 380, 16)
link('Open the operator screen', 'https://makssay.github.io/AirLock/#testnet', 62, 118)
text('Wallet-free playground', 505, 200, 19, True)
para('Virtual funds and real Telegram alerts', 505, 176, 390, 16)
link('Try Airlock', 'https://airlock-v3-by-makssay-and-kuznets.vercel.app/#try', 505, 118)
text('V3 chain 420420777', 62, 61, 13, color=MUTED)
text('0x3bbb62bf86d40f26a87e70fe56ee073e69198713', 62, 40, 13)
c.showPage()

slide('A service for teams already automating payouts')
para('Open-source contracts with managed monitoring and onboarding', 62, 400, 820, 23, BLUE)
text('$99 / month', 62, 294, 38, True)
para('One treasury<br/>Monitoring and guardian workflow support', 62, 263, 390, 18)
text('$500', 532, 294, 38, True)
para('One-time onboarding', 532, 263, 350, 18)
line(184)
text('Next: three test-treasury pilots', 62, 147, 22, True, BLUE)
para('Validate operational effort and willingness to pay.', 62, 124, 800, 17)
text('Customers keep their keys. Proposed pricing awaits pilot validation.', 62, 64, 14, color=MUTED)
link('github.com/Makssay/AirLock', 'https://github.com/Makssay/AirLock', 62, 36)
link('Demo video', 'https://youtu.be/LKbyCsM62rQ', 638, 36)
link('Product', 'https://makssay.github.io/AirLock/', 802, 36)
c.showPage()
c.save()
print(OUTPUT)
