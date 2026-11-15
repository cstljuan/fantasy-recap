// The small stage every scene draws on. Authored on a 1920x1080 grid; st.S scales to the output size.
class Stage2D {
  constructor(canvas, W, H) {
    this.W = W; this.H = H; this.S = W / 1920;
    canvas.width = W; canvas.height = H;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.images = {};
  }
  async load(map) {
    for (const [k, src] of Object.entries(map)) { const i = new Image(); i.src = src; await i.decode(); this.images[k] = i; }
  }
  // begin(null) leaves the frame transparent, for alpha overlays.
  begin(bg = '#000') {
    const x = this.ctx;
    x.setTransform(1, 0, 0, 1, 0, 0); x.filter = 'none'; x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, this.W, this.H);
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, this.W, this.H); }
    x.setTransform(this.S, 0, 0, this.S, 0, 0);
  }
}
window.Stage2D = Stage2D;
