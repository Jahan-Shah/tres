# Tetrahedron

![](/cientos/tetrahedron.png)

The `cientos` package provides a `<Tetrahedron />` component that serves as a short-cut for a `TetrahedronGeometry` and a `MeshBasicMaterial` with a `Mesh` object.

## Usage

```html
<Tetrahedron :args="[1, 0]" color="yellow" />

// Tetrahedron with a custom material transformations
<Tetrahedron ref="tetrahedronRef" :args="[1, 0]" :position="[2, 4, 0]">
  <TresMeshToonMaterial color="yellow" />
</Tetrahedron>
```

