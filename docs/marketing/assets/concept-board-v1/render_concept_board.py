from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path
import random, math

OUT = Path(__file__).parent
W, H = 1080, 1350
SERIF = "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"
SERIF_B = "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf"
SANS = "/usr/share/fonts/truetype/ubuntu/Ubuntu[wdth,wght].ttf"
SANS_B = "/usr/share/fonts/truetype/ubuntu/Ubuntu[wdth,wght].ttf"


def font(path, size):
    return ImageFont.truetype(path, size)


def grain(im, intensity=22, seed=3):
    random.seed(seed)
    px = im.load()
    for y in range(0, H, 2):
        for x in range(0, W, 2):
            r,g,b = px[x,y][:3]
            n = random.randint(-intensity, intensity)
            px[x,y] = (max(0,min(255,r+n)), max(0,min(255,g+n)), max(0,min(255,b+n)))
    return im


def utility(draw, text, xy, fill, size=24):
    draw.text(xy, text, font=font(SANS_B, size), fill=fill, spacing=0)


def save(im, name):
    grain(im, seed=sum(map(ord,name))).save(OUT / name)

# A: Kinetic type / data rhythm
im = Image.new("RGB", (W,H), "#101010")
d = ImageDraw.Draw(im)
red, bone = "#E83A22", "#F2EDE3"
# editorial bands and fragmented physical signal
for i in range(10):
    y = 385 + i * 43
    d.line((50,y,1030,y), fill=red if i in (1,5,8) else "#632019", width=2)
for i in range(26):
    x = 35 + i*43
    h = 80 + (i*37)%290
    d.rectangle((x, 910-h, x+17, 910), fill=red if i%4 else "#7C241B")
# huge words intentionally clipped
for word,y in [("CONTEXT",-70),("REALITY",170)]:
    d.text((-42,y), word, font=font(SERIF_B,198), fill=bone)
# visual interruption
for k in range(4):
    x=170+k*200
    d.rectangle((x, 410, x+98, 630), fill=red)
    d.line((x-35, 650, x+130, 410), fill=bone, width=7)
utility(d,"AGYM / CONCEPT 01",(60,690),bone,25)
utility(d,"RAW > REVIEWED > READY",(60,735),red,35)
d.text((55,1000),"STOP RE-EXPLAINING",font=font(SANS_B,59),fill=bone)
d.text((55,1063),"YOUR FITNESS HISTORY TO AI.",font=font(SANS_B,45),fill=bone)
utility(d,"KINETIC TYPE / DATA RHYTHM",(60,1245),red,21)
save(im,"agym-concept-a-kinetic-type-v1-finished.png")

# B: Distorted-object translation
im = Image.new("RGB", (W,H), "#F4EFE7")
d = ImageDraw.Draw(im)
ink, orange = "#1A1817", "#FF4B19"
# giant overlapping utility/display type
for txt,xy in [("RAW",(-45,-45)),("READY",(80,1010))]:
    d.text(xy,txt,font=font(SERIF_B,225),fill=ink)
# Original non-branded abstract training load: pixel blocks resolving to a precise ring/line
random.seed(9)
for i in range(145):
    x=random.randint(130,930); y=random.randint(300,905)
    s=random.choice([9,13,18,24,32])
    if ((x-535)/390)**2+((y-615)/255)**2 < 1:
        d.rectangle((x,y,x+s,y+s),fill=orange if i%3 else "#C9381A")
# precision geometry after the noisy mass
for r in (150,165,180): d.ellipse((535-r,615-r,535+r,615+r),outline=ink,width=3)
d.line((160,615,910,615),fill=ink,width=5)
d.line((535,270,535,970),fill=ink,width=2)
d.rectangle((453,533,617,697),outline=ink,width=7)
utility(d,"UNSTRUCTURED INPUT",(72,270),ink,22)
utility(d,"CONFIRMED CONTEXT",(650,918),ink,22)
d.text((66,900),"TRAINING HAPPENED.",font=font(SANS_B,42),fill=ink)
d.text((66,950),"NOW MAKE IT USABLE.",font=font(SANS_B,42),fill=ink)
utility(d,"DISTORTED-OBJECT / TRANSLATION",(66,1250),orange,21)
save(im,"agym-concept-b-distorted-translation-v1-finished.png")

# C: Motion-field editorial
im = Image.new("RGB", (W,H), "#123C42")
d = ImageDraw.Draw(im)
shell, coral = "#F1E7D7", "#F07C73"
# contour field as technical/motion energy
for i in range(19):
    offset = i*25
    pts=[]
    for x in range(-80,W+80,12):
        y=735 + math.sin((x+offset)/82)*82 + math.sin((x-offset)/35)*18 + (i-9)*18
        pts.append((x,y))
    d.line(pts,fill=coral,width=4)
# Original abstract sprint gesture (not person)
d.polygon([(500,250),(590,370),(555,560),(710,760),(660,915),(505,675),(430,485)],fill=shell)
d.polygon([(555,340),(705,250),(742,300),(615,470)],fill=coral)
d.polygon([(485,650),(360,880),(425,915),(560,740)],fill=coral)
# large type behind/over gesture
d.text((48,-70),"AFTER",font=font(SERIF_B,220),fill=coral)
d.text((90,925),"THE PLAN",font=font(SERIF_B,165),fill=shell)
utility(d,"AGYM / CONCEPT 03",(65,270),shell,24)
utility(d,"REALITY MOVES FORWARD",(65,315),coral,28)
d.text((65,1125),"YOUR AI NEEDS THE PART",font=font(SANS_B,40),fill=shell)
d.text((65,1175),"THAT HAPPENED AFTER.",font=font(SANS_B,40),fill=shell)
utility(d,"MOTION FIELD / EDITORIAL",(65,1250),coral,21)
save(im,"agym-concept-c-motion-field-v1-finished.png")

# landscape review board
board = Image.new("RGB",(1800,1150),"#0E0E0E")
bd=ImageDraw.Draw(board)
bd.text((70,55),"AGYM / VISUAL SYSTEM CONCEPT BOARD",font=font(SANS_B,47),fill="#F2EDE3")
bd.text((70,115),"Founder-reference-derived directions. Internal review only. No third-party assets reused.",font=font(SANS,25),fill="#B8B0A4")
for i,(file,label,desc) in enumerate([
    ("agym-concept-a-kinetic-type-v1-finished.png","A / KINETIC TYPE","Pain point becomes the poster. High urgency."),
    ("agym-concept-b-distorted-translation-v1-finished.png","B / TRANSLATION","Messy input resolves into usable context."),
    ("agym-concept-c-motion-field-v1-finished.png","C / MOTION FIELD","Athletic energy, less literal product framing."),
]):
    tile=Image.open(OUT/file).resize((490,612))
    x=70+i*575
    board.paste(tile,(x,215))
    bd.text((x,855),label,font=font(SANS_B,27),fill="#F2EDE3")
    bd.text((x,895),desc,font=font(SANS,20),fill="#B8B0A4")
bd.text((70,1050),"Decision request: choose A, B, C, or a named combination before any polished campaign creative is generated.",font=font(SANS_B,24),fill="#F07C73")
board.save(OUT / "agym-concept-board-v1-finished.png")
