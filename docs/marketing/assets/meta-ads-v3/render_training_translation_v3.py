from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import random, math

OUT = Path(__file__).parent
SERIF = "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf"
SANS = "/usr/share/fonts/truetype/ubuntu/Ubuntu[wdth,wght].ttf"


def f(path, size): return ImageFont.truetype(path, size)

def texture(im, seed):
    random.seed(seed)
    px = im.load(); w,h = im.size
    for y in range(0,h,2):
        for x in range(0,w,2):
            r,g,b = px[x,y][:3]; n=random.randint(-11,11)
            px[x,y]=(max(0,min(255,r+n)),max(0,min(255,g+n)),max(0,min(255,b+n)))
    return im

def utility(d, text, xy, color, size=23): d.text(xy,text,font=f(SANS,size),fill=color)

def training_field(w,h,bg,ink,signal,seed):
    im=Image.new('RGB',(w,h),bg); d=ImageDraw.Draw(im)
    random.seed(seed)
    # Fragmented raw training input: squares cohere toward a confirmed set marker.
    cx,cy=int(w*.52),int(h*.48)
    for i in range(105):
        a=random.random()*math.tau; r=random.uniform(80,min(w,h)*.32)
        x=int(cx+math.cos(a)*r); y=int(cy+math.sin(a)*r*.62)
        s=random.choice([8,11,15,21,29])
        d.rectangle((x,y,x+s,y+s),fill=signal if i%3 else '#B53A22')
    # A rep / interval trace: physical training cue, not UI.
    pts=[]
    for x in range(-20,w+30,10):
        y=int(cy+125*math.sin((x-70)/66)+22*math.sin(x/19))
        pts.append((x,y))
    d.line(pts,fill=ink,width=6)
    # Confirmed set mark: structured, original geometry.
    for r in (66,83,100): d.ellipse((cx-r,cy-r,cx+r,cy+r),outline=ink,width=3)
    d.rectangle((cx-43,cy-43,cx+43,cy+43),outline=ink,width=7)
    d.line((cx-150,cy,cx+150,cy),fill=ink,width=3)
    return texture(im,seed)

def save(im,name): im.save(OUT/name)

# M1 primary feed: B logic, primary palette
w=h=1080; bg='#F4EFE7'; ink='#1A1817'; orange='#FF4B19'
base=training_field(w,h,bg,ink,orange,21)
save(base,'agym-meta-m1-training-translation-v3-background.png')
im=base.copy(); d=ImageDraw.Draw(im)
d.text((110,0),'TRAINING',font=f(SERIF,168),fill=ink)
utility(d,'RAW TRAINING LOG', (68,188),ink,22)
utility(d,'SET 04  /  3 x 5  /  ACTUAL', (68,225),orange,26)
utility(d,'CONFIRMED CONTEXT', (650,730),ink,21)
d.text((63,810),'STOP RE-EXPLAINING',font=f(SANS,52),fill=ink)
d.text((63,870),'YOUR TRAINING TO AI.',font=f(SANS,52),fill=ink)
utility(d,'AGYM  /  TRAINING REALITY > USABLE CONTEXT', (63,1012),orange,18)
save(im,'agym-meta-m1-training-translation-v3-finished.png')

# 4:5 variation: same B mechanism, C palette as allowed secondary input
w,h=1080,1350; bg='#123C42'; shell='#F1E7D7'; coral='#F07C73'
base=training_field(w,h,bg,shell,coral,34)
save(base,'agym-meta-m1-training-nightfield-v3-background.png')
im=base.copy(); d=ImageDraw.Draw(im)
d.text((160,0),'SESSION',font=f(SERIF,180),fill=shell)
utility(d,'TRAINING LOG  /  SESSION 18', (68,215),shell,24)
utility(d,'SET 04  >  CONFIRMED', (68,255),coral,28)
utility(d,'YOUR TRAINING', (615,820),shell,22)
utility(d,'BECOMES USABLE CONTEXT', (615,850),shell,17)
d.text((63,1045),'TRAINING HAPPENED.',font=f(SANS,52),fill=shell)
d.text((63,1108),'NOW MAKE IT USABLE.',font=f(SANS,52),fill=shell)
utility(d,'AGYM  /  RAW > REVIEWED > READY', (63,1265),coral,19)
save(im,'agym-meta-m1-training-nightfield-v3-finished.png')
