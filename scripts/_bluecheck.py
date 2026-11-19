from PIL import Image
import numpy as np

for f in ['assets/img/logo-mark.png', 'assets/img/logo.png']:
    a = np.array(Image.open(f).convert('RGBA')).astype(int)
    r, g, b, al = a[:, :, 0], a[:, :, 1], a[:, :, 2], a[:, :, 3]
    blue = (al > 120) & (b > 140) & (b > r + 60) & (b > g + 60) & (r < 130)
    ys, xs = np.where(blue)
    print(f, a.shape[:2], '藍像素:', int(blue.sum()))
    if len(xs):
        print('   bbox:', (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())))
        print('   上緣藍數:', int(blue[ys.min():ys.min() + 8, :].sum()), '下緣:', int(blue[max(0, ys.max() - 7):ys.max() + 1, :].sum()))
        print('   左緣藍數:', int(blue[:, xs.min():xs.min() + 8].sum()), '右緣:', int(blue[:, max(0, xs.max() - 7):xs.max() + 1].sum()))
