/**
 * Konva shim for browser environment
 * Konva is loaded via a script tag and available on window.Konva
 * This shim allows our TypeScript modules to import it normally
 */

// Konva is loaded globally via script tag
const Konva = (window as unknown as { Konva: typeof import("konva").default }).Konva;

export default Konva;
export { Konva };
