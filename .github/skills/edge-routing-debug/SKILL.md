---
name: edge-routing-debug
description: Debug edge routing issues in SFCC Manifold pipeline visualizations. Use when investigating wrong paths, overlapping edges, incorrect entry/exit sides, or routing bugs in the canvas graph.
---

# Debugging Edge Routing Issues

When a user reports issues with edge routing (wrong paths, overlapping edges, incorrect entry/exit sides), follow this workflow:

## Step 1: Generate a Layout Dump

Always start by generating an ASCII layout dump of the problematic pipeline:

```bash
npm run dump-layout -- <path-to-pipeline.xml> -F
```

This outputs to `debug/layouts/<pipeline-name>.txt` and includes:
- **Grid view**: Node positions in grid coordinates
- **Node list**: All nodes with pixel positions, grid positions, branch, type
- **Edge list**: Each edge with `out=<side>` and `in=<side>`, anchor coordinates
- **Full layout** (`-F`): ASCII visualization showing actual routed paths

**Why this works**: The dump-layout script uses the **exact same routing functions** as the webview (`buildOrthogonalPath`, `determineSidesFromMap`, `getAnchorPoint`). If the ASCII dump shows the wrong routing, the bug is in the shared routing code. If the dump is correct but the webview is wrong, the bug is in Konva rendering.

## Step 2: Analyze the Dump

Look for:
1. **Edge sides**: Check `out=<side>` and `in=<side>` - are they what you expect?
2. **Anchor positions**: Do the `@(x, y)` coordinates make sense for the node positions?
3. **ASCII paths**: In the full layout, trace the edge visually - does it take the expected route?

Example edge line:
```
- Assign [out=bottom @( 370, 910 )] --in1--> [in=left @( 580, 980 )] Join
```
This shows: exit from bottom of "Assign", enter left side of "Join" - an L-shaped path.

## Step 3: Enable Debug Logging (if needed)

If the dump doesn't reveal the issue, enable debug logging in the side determination:

```typescript
import { setDebugLogging } from "./edges/sideDetermination";
setDebugLogging(true);
```

This logs detailed decisions for each edge routing calculation to the console.

## Step 4: Request User Information

If you cannot reproduce the issue, ask the user to provide:
1. **The pipeline XML file** (or a minimal reproduction)
2. **Screenshot** of the incorrect rendering
3. **Expected behavior** description
4. **Run the dump-layout command** and share the output:
   ```bash
   npm run dump-layout -- <their-pipeline.xml> -F --show-bendpoints
   ```

## Edge Routing Module Structure

The routing logic is split into focused modules in `src/webview-ui/edges/`:

| Module | Responsibility |
|--------|----------------|
| `sideDetermination.ts` | Decides which side edges exit/enter nodes |
| `anchors.ts` | Calculates exact anchor points on node boundaries |
| `pathBuilder.ts` | Builds orthogonal paths between anchors |
| `pathfinding.ts` | A* algorithm for obstacle avoidance |
| `collision.ts` | Node/segment collision detection |
| `edgeUtils.ts` | Label normalization, bendpoint inference |

When debugging, identify which module is responsible for the incorrect behavior.
