import type { Wardrobe } from "../style/styles";
import { finishCutout, loadPhoto } from "./cutout";
import { extractItem, jpegOf } from "./gemini";
import { listItems, type Found } from "./tags";

// Work done ahead, so a photo with several pieces doesn't keep you waiting:
// as soon as the AI has listed a photo's pieces, every one starts being
// redrawn (a few at a time, so Gemini doesn't turn requests away), and while
// you look at them the next photo is listed and its pieces started too.
export const AT_ONCE = 3;
type Opened = { photo: Promise<HTMLCanvasElement>; listed: Promise<Awaited<ReturnType<typeof listItems>>> };
export class Ahead {
  private photos = new Map<Blob, Opened>();
  private drawings = new Map<Found, Promise<HTMLCanvasElement>>();
  private running = 0;
  private waiting: (() => void)[] = [];
  private stopped = false;

  /** a photo, opened, and the AI's list of its pieces (null: it didn't answer) */
  open(file: Blob, cats: string[], wardrobe: Wardrobe): Opened {
    let o = this.photos.get(file);
    if (!o) {
      const photo = loadPhoto(file);
      const listed = photo.then(async (p) => {
        const found = await listItems(jpegOf(p), cats, wardrobe);
        if (found && !this.stopped) for (const item of found.items) this.drawing(p, item);
        return found;
      });
      photo.catch(() => {});
      listed.catch(() => {});
      this.photos.set(file, (o = { photo, listed }));
    }
    return o;
  }

  /** one listed piece, redrawn on its own and finished */
  drawing(photo: HTMLCanvasElement, item: Found): Promise<HTMLCanvasElement> {
    let d = this.drawings.get(item);
    if (!d) {
      d = this.slot(() => extractItem(photo, item.name, item.description, item.colors)).then(finishCutout);
      d.catch(() => {});
      this.drawings.set(item, d);
    }
    return d;
  }

  // waits for one of the AT_ONCE places; a finished redraw hands its place on
  private async slot<T>(work: () => Promise<T>): Promise<T> {
    if (this.running < AT_ONCE) this.running++;
    else await new Promise<void>((go) => this.waiting.push(go));
    try {
      if (this.stopped) throw new Error("stopped");
      return await work();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.running--;
    }
  }

  /** STOP or closing: nothing new starts; what's running is ignored */
  stop() {
    this.stopped = true;
    for (const go of this.waiting.splice(0)) go();
  }
}
