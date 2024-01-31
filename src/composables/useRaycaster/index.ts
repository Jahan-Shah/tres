import { Vector2 } from 'three'
import type { Object3D, Intersection } from 'three'
import type { Ref } from 'vue'
import { computed, onUnmounted, watchEffect } from 'vue'
import type { EventHook } from '@vueuse/core'
import { createEventHook, useElementBounding, usePointer } from '@vueuse/core'

import { type TresContext } from '../useTresContextProvider'

export type Intersects = Intersection<THREE.Object3D<THREE.Object3DEventMap>>[]
interface PointerMoveEventPayload {
  intersects?: Intersects
  event: PointerEvent
}

interface PointerClickEventPayload {
  intersects: Intersects
  event: PointerEvent
}

interface WheelEventPayload {
  intersects: Intersects
  event: WheelEvent
}

export const useRaycaster = (
  objects: Ref<THREE.Object3D[]>,
  ctx: TresContext,
) => {
  // having a separate computed makes useElementBounding work
  const canvas = computed(() => ctx.renderer.value.domElement as HTMLCanvasElement)

  const { x, y } = usePointer({ target: canvas })

  const { width, height, top, left } = useElementBounding(canvas)

  const getRelativePointerPosition = ({ x, y }: { x: number; y: number }) => {
    if (!canvas.value) return

    return {
      x: ((x - left.value) / width.value) * 2 - 1,
      y: -((y - top.value) / height.value) * 2 + 1,
    }
  }

  const getIntersectsByRelativePointerPosition = ({ x, y }: { x: number; y: number }) => {
    if (!ctx.camera.value) return

    ctx.raycaster.value.setFromCamera(new Vector2(x, y), ctx.camera.value)

    return ctx.raycaster.value.intersectObjects(objects.value, true)
  }

  const getIntersects = (event?: PointerEvent | MouseEvent | WheelEvent) => {
    const pointerPosition = getRelativePointerPosition({
      x: event?.clientX ?? x.value,
      y: event?.clientY ?? y.value,
    })
    if (!pointerPosition) return []

    return getIntersectsByRelativePointerPosition(pointerPosition) || []
  }

  const intersects = computed<Intersects>(() => getIntersects())

  const eventHookClick = createEventHook<PointerClickEventPayload>()
  const eventHookDblClick = createEventHook<PointerClickEventPayload>()
  const eventHookPointerMove = createEventHook<PointerMoveEventPayload>()
  const eventHookPointerUp = createEventHook<PointerMoveEventPayload>()
  const eventHookPointerDown = createEventHook<PointerMoveEventPayload>()
  const eventHookContextMenu = createEventHook<PointerClickEventPayload>()
  const eventHookWheel = createEventHook<WheelEventPayload>()


  const triggerEventHook = (eventHook: EventHook, event: PointerEvent | MouseEvent | WheelEvent) => {
    eventHook.trigger({ event, intersects: getIntersects(event) })
  }

  let previousPointerMoveEvent: PointerEvent | undefined = undefined;
  const onPointerMove = (event: PointerEvent) => {
    triggerEventHook(eventHookPointerMove, event)
    previousPointerMoveEvent = event;
  }

  const forceUpdate = () => {
    if(previousPointerMoveEvent)
      triggerEventHook(eventHookPointerMove, previousPointerMoveEvent);
  }

  // a click event is fired whenever a pointerdown happened after pointerup on the same object
  let mouseDownObject: Object3D | undefined = undefined

  const onPointerDown = (event: PointerEvent) => {
    mouseDownObject = getIntersects(event)[0]?.object
    triggerEventHook(eventHookPointerDown, event)
  }

  let previousClickObject: Object3D | undefined = undefined
  let doubleClickConfirmed: boolean = false;

  const onPointerUp = (event: MouseEvent) => {
    if (!(event instanceof PointerEvent)) return // prevents triggering twice on mobile devices

    if (mouseDownObject === getIntersects(event)[0]?.object) {
      // We clicked on the object, update the count
      if(event.button === 0) {
        // Left click
        triggerEventHook(eventHookClick, event)

        if(previousClickObject === getIntersects(event)[0]?.object) {
          // console.log("Double click confirmed");
          doubleClickConfirmed = true;
        } else {
          // console.log("Double click NOT confirmed");
          previousClickObject = getIntersects(event)[0]?.object;
          doubleClickConfirmed = false;
        }
      }else if(event.button === 2) {
        // Right click
        triggerEventHook(eventHookContextMenu, event)
      }
    }

    triggerEventHook(eventHookPointerUp, event);
  }

  const onDoubleClick = (event: MouseEvent) => {
      if(doubleClickConfirmed) {
        triggerEventHook(eventHookDblClick, event)
        previousClickObject = undefined;
        doubleClickConfirmed = false;
      }
  }

  const onPointerLeave = (event: PointerEvent) => eventHookPointerMove.trigger({ event, intersects: [] })

  const onWheel = (event: WheelEvent) => eventHookWheel.trigger({ event, intersects: getIntersects(event) })

  canvas.value.addEventListener('pointerup', onPointerUp)
  canvas.value.addEventListener('pointerdown', onPointerDown)
  canvas.value.addEventListener('pointermove', onPointerMove)
  canvas.value.addEventListener('pointerleave', onPointerLeave)
  canvas.value.addEventListener('dblclick', onDoubleClick);
  canvas.value.addEventListener('wheel', onWheel);

  onUnmounted(() => {
    if (!canvas?.value) return
    canvas.value.removeEventListener('pointerup', onPointerUp)
    canvas.value.removeEventListener('pointerdown', onPointerDown)
    canvas.value.removeEventListener('pointermove', onPointerMove)
    canvas.value.removeEventListener('pointerleave', onPointerLeave)
    canvas.value.removeEventListener('dblclick', onDoubleClick)
    canvas.value.removeEventListener('wheel', onWheel)
  })

  return {
    intersects,
    onClick: (fn: (value: PointerClickEventPayload) => void) => eventHookClick.on(fn).off,
    onDblClick: (fn: (value: PointerClickEventPayload) => void) => eventHookDblClick.on(fn).off,
    onContextMenu: (fn: (value: PointerClickEventPayload) => void) => eventHookContextMenu.on(fn).off,
    onPointerMove: (fn: (value: PointerMoveEventPayload) => void) => eventHookPointerMove.on(fn).off,
    onPointerUp: (fn: (value: PointerMoveEventPayload) => void) => eventHookPointerUp.on(fn).off,
    onPointerDown: (fn: (value: PointerMoveEventPayload) => void) => eventHookPointerDown.on(fn).off,
    onWheel: (fn: (value: WheelEventPayload) => void) => eventHookWheel.on(fn).off,
    forceUpdate,
  }
}
