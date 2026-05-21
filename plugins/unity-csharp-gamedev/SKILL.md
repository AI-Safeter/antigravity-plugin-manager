---
name: unity-csharp-gamedev
description: Unity game development in C#. Covers MonoBehaviour lifecycle (Awake/Start/Update/FixedUpdate/LateUpdate/OnEnable/OnDisable), ScriptableObjects for shared data, prefab workflows, Addressables for asset loading, the new Input System, an overview of DOTS/ECS, and performance practices (avoid GameObject.Find, pool objects, cache components). Use this skill when writing or reviewing C# scripts for Unity 2022 LTS or newer.
---

# Unity C# Gamedev

Unity uses C# scripts attached to GameObjects via MonoBehaviours. The engine calls lifecycle methods on a fixed schedule; `Update` runs per frame, `FixedUpdate` runs at a fixed physics timestep. Performance hinges on avoiding per-frame allocations and reflection-heavy lookups.

## Use this skill when

- Writing or reviewing MonoBehaviour scripts (movement, AI, UI logic)
- Designing data via ScriptableObjects for designer-tweakable configs
- Building prefab variants and addressables for content pipelines
- Hooking up the new Input System (`InputAction`, `PlayerInput`)
- Profiling and optimizing hot loops, pooling objects, caching components
- Deciding when classic MonoBehaviour vs DOTS/ECS is appropriate

## Do not use this skill when

- Working in Unreal Engine (different scripting model entirely)
- Authoring shaders only (use a Shader Graph / HLSL skill)
- Writing pure C# tooling outside the Unity runtime

## Core concepts

A MonoBehaviour has a strict callback order: `Awake` (once, on load), `OnEnable`, `Start` (once, before first frame), `Update` (per frame), `LateUpdate` (after Update, good for camera follow), `FixedUpdate` (physics step), `OnDisable`, `OnDestroy`. Coroutines run alongside `Update`. The engine serializes public and `[SerializeField]` private fields into the Inspector.

## Quick start

```csharp
using UnityEngine;
using UnityEngine.InputSystem;

[RequireComponent(typeof(Rigidbody))]
public class PlayerController : MonoBehaviour
{
    [SerializeField] private float moveSpeed = 5f;
    [SerializeField] private PlayerStats stats; // ScriptableObject

    private Rigidbody _rb;
    private Vector2 _moveInput;

    private void Awake() => _rb = GetComponent<Rigidbody>();

    public void OnMove(InputAction.CallbackContext ctx) => _moveInput = ctx.ReadValue<Vector2>();

    private void FixedUpdate()
    {
        var velocity = new Vector3(_moveInput.x, 0f, _moveInput.y) * (moveSpeed * stats.SpeedMultiplier);
        _rb.MovePosition(_rb.position + velocity * Time.fixedDeltaTime);
    }
}

[CreateAssetMenu(menuName = "Game/PlayerStats")]
public class PlayerStats : ScriptableObject
{
    public float SpeedMultiplier = 1f;
    public int MaxHealth = 100;
}
```

## Key patterns

### Cache component references
`GetComponent<T>()` is cheap but not free; call it in `Awake` and store the result. Never call it in `Update`.

### ScriptableObjects for shared data
Use them for tunable stats, enemy definitions, dialogue tables. They live as assets, are reference-shared between scenes, and survive domain reloads.

### Object pooling
`UnityEngine.Pool.ObjectPool<T>` (Unity 2021+) avoids GC spikes from frequent `Instantiate`/`Destroy` (bullets, particles, enemies).

### Input System
Define an `InputActionAsset`, attach `PlayerInput`, and route events to script methods. The legacy `Input.GetKey` API still works but doesn't support rebinding or controllers cleanly.

### Addressables
`Addressables.LoadAssetAsync<GameObject>("enemy_grunt")` defers loading until needed and supports remote content updates. Replaces `Resources.Load` for shippable projects.

### Coroutines vs async
Use coroutines for time-sliced gameplay logic (`yield return new WaitForSeconds(1f)`). Use `async`/`await` with `UniTask` or `Awaitable` (Unity 2023+) for I/O and structured concurrency.

### When to use DOTS/ECS
DOTS (Entities + Burst + Jobs) is for thousands of similar entities (RTS units, particles, simulations). For typical character-driven games stick with MonoBehaviour; ECS has a steep authoring cost.

## Common pitfalls

- Calling `GameObject.Find`, `FindObjectOfType`, or `Camera.main` every frame; cache references in `Awake`.
- Allocating in `Update` (new arrays, lambdas capturing locals, boxing structs) and triggering GC stutter.
- Moving a `Rigidbody` via `transform.position` instead of `Rigidbody.MovePosition`; breaks physics interpolation.
- Putting physics queries in `Update` instead of `FixedUpdate`.
- Forgetting `[SerializeField]` on private fields you want exposed in the Inspector.
- Using `Resources.Load` for everything; bloats the build and prevents async/streamed loading.
- Subscribing to events in `OnEnable` but not unsubscribing in `OnDisable`; causes leaks on reload.
- Treating MonoBehaviour constructors as initialization; Unity uses `Awake`, not `new`.

## Reference

- Official manual: https://docs.unity3d.com/Manual/index.html
- Scripting API: https://docs.unity3d.com/ScriptReference/
- DOTS: https://docs.unity3d.com/Packages/com.unity.entities@latest
- Related: [[godot-engine]]
