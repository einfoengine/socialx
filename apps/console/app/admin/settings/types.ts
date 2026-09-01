/** Every settings action answers in this shape. Shared by the client components,
    which cannot import it from a "use server" file without dragging the actions
    themselves into the bundle graph. */
export type ActionResult = { ok: true; message: string } | { ok: false; error: string };
