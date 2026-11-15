// The address of the hosted plays service, for the hosted app (GitHub Pages and the phone app).
// Empty means the app plays from its files only, as before. With an address, a page that is not on
// localhost and has no ?api= of its own opens as if ?api=<this address> had been typed (index.html).
// The service is server/ on Render (render.yaml); it talks to the Tiger Data database.
window.FR_LIVE_API = 'https://fantasy-recap-7uj5.onrender.com';
