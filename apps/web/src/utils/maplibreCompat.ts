import * as maplibregl from 'maplibre-gl';

const patchedTransformPrototypes = new WeakSet<object>();

function ensureTransformPrototypePatched(tr: unknown): void {
  if (!tr || typeof tr !== 'object') return;
  const proto = Object.getPrototypeOf(tr);
  if (!proto || patchedTransformPrototypes.has(proto)) return;
  patchedTransformPrototypes.add(proto);

  const patchSetter = (prop: string, setterFn: (this: Record<string, any>, val: any) => void) => {
    const desc = Object.getOwnPropertyDescriptor(proto, prop);
    if (desc && desc.get && !desc.set) {
      Object.defineProperty(proto, prop, {
        configurable: true,
        enumerable: desc.enumerable ?? true,
        get: desc.get,
        set: setterFn,
      });
    }
  };

  patchSetter('pixelsToGLUnits', function setPixelsToGLUnits() {
    // No-op: MercatorTransform computes pixelsToGLUnits dynamically from _helper
  });
  patchSetter('zoom', function setZoomProp(val: number) {
    if (typeof this.setZoom === 'function') this.setZoom(val);
  });
  patchSetter('bearing', function setBearingProp(val: number) {
    if (typeof this.setBearing === 'function') this.setBearing(val);
  });
  patchSetter('pitch', function setPitchProp(val: number) {
    if (typeof this.setPitch === 'function') this.setPitch(val);
  });
  patchSetter('padding', function setPaddingProp(val: unknown) {
    if (typeof this.setPadding === 'function') this.setPadding(val);
  });
  patchSetter('center', function setCenterProp(val: unknown) {
    if (typeof this.setCenter === 'function') this.setCenter(val);
  });
}

const mapProto = maplibregl?.Map?.prototype as Record<string, any> | undefined;

if (mapProto) {
  if (!('transform' in mapProto)) {
    Object.defineProperty(mapProto, 'transform', {
      configurable: true,
      enumerable: true,
      get(this: Record<string, any>) {
        const tr = this._camera?._transform ?? this._camera?.transform;
        ensureTransformPrototypePatched(tr);
        return tr;
      },
      set(this: Record<string, any>, nextTransform: unknown) {
        ensureTransformPrototypePatched(nextTransform);
        if (this._camera) {
          this._camera._transform = nextTransform;
        }
      },
    });
  }

  if (!mapProto._cbmsRenderPatched && typeof mapProto._render === 'function') {
    const origRender = mapProto._render;
    mapProto._cbmsRenderPatched = true;
    mapProto._render = function patchedRender(
      this: Record<string, any>,
      paintStartTimeStamp?: number,
    ) {
      if (!this.style?._loaded) {
        return this;
      }
      return origRender.call(
        this,
        typeof paintStartTimeStamp === 'number' ? paintStartTimeStamp : performance.now(),
      );
    };
  }

  // Guard removeSource so React 18 unmount ordering never throws "Source cannot be removed while layer is using it"
  if (!mapProto._cbmsRemoveSourcePatched && typeof mapProto.removeSource === 'function') {
    const origRemoveSource = mapProto.removeSource;
    mapProto._cbmsRemoveSourcePatched = true;
    mapProto.removeSource = function patchedRemoveSource(
      this: Record<string, any>,
      sourceId: string,
    ) {
      try {
        if (!this.style || !this.getSource?.(sourceId)) {
          return this;
        }
        const styleLayers = this.getStyle?.()?.layers;
        if (Array.isArray(styleLayers)) {
          for (const layer of styleLayers) {
            if (layer && layer.source === sourceId && this.getLayer?.(layer.id)) {
              this.removeLayer(layer.id);
            }
          }
        }
        return origRemoveSource.call(this, sourceId);
      } catch {
        return this;
      }
    };
  }

  // Guard queryRenderedFeatures so querying a layer ID that isn't mounted yet never throws
  if (!mapProto._cbmsQueryPatched && typeof mapProto.queryRenderedFeatures === 'function') {
    const origQueryRenderedFeatures = mapProto.queryRenderedFeatures;
    mapProto._cbmsQueryPatched = true;
    mapProto.queryRenderedFeatures = function patchedQueryRenderedFeatures(
      this: Record<string, any>,
      geometryOrOptions?: unknown,
      options?: Record<string, any>,
    ) {
      try {
        if (!this.style?._loaded) {
          return [];
        }
        if (options && Array.isArray(options.layers)) {
          const validLayers = options.layers.filter((id: string) =>
            Boolean(this.getLayer?.(id)),
          );
          if (validLayers.length === 0) return [];
          return origQueryRenderedFeatures.call(this, geometryOrOptions, {
            ...options,
            layers: validLayers,
          });
        }
        return origQueryRenderedFeatures.call(this, geometryOrOptions, options);
      } catch {
        return [];
      }
    };
  }
}

export { maplibregl };
