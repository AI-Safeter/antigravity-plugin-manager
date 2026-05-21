---
name: godot-engine
description: Godot 4 game development. Covers the node and scene system, GDScript syntax (typed variables, signals, await), exported variables shown in the Inspector, physics layers and masks, AnimationPlayer vs Tween for animation, autoload singletons, and when to choose C# over GDScript. Use this skill when authoring or reviewing Godot 4 projects in GDScript or C#.
---

# Godot Engine

Godot 4 is a free, open-source engine built around a tree of Nodes grouped into Scenes. Scenes can be instanced into other scenes, which is Godot's main composition primitive. GDScript is the first-class language; C# is also supported with the .NET build of the engine.

## Use this skill when

- Structuring a project with Nodes, Scenes, and scene instancing
- Writing GDScript with typed variables, `signal` declarations, and `await`
- Exposing variables to the Inspector with `@export` and grouping them
- Configuring physics layers/masks for collision filtering
- Choosing between `AnimationPlayer`, `AnimationTree`, and `Tween`
- Adding autoload singletons for global state (input, audio, save data)
- Deciding when to drop into C# for performance or library reuse

## Do not use this skill when

- Working in Godot 3.x (significant API differences from 4.x)
- Working in Unity, Unreal, or another engine
- Authoring shaders only (different mental model, separate skill)

## Core concepts

Nodes are the smallest units of behavior (Node, Node2D, Node3D, Control, RigidBody3D, etc.). A Scene is a tree of nodes saved as a `.tscn` file. Any scene can be instanced as a child of another. Signals are the engine's event system: nodes emit named signals that other nodes connect to. GDScript is Python-like but statically typed when you annotate.

## Quick start

```gdscript
# player.gd
extends CharacterBody3D

signal health_changed(new_health: int)

@export var speed: float = 5.0
@export_range(0, 100) var max_health: int = 100
@export var bullet_scene: PackedScene

var health: int = max_health

func _ready() -> void:
    add_to_group("players")

func _physics_process(delta: float) -> void:
    var input := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
    velocity = Vector3(input.x, 0, input.y) * speed
    move_and_slide()

func take_damage(amount: int) -> void:
    health = max(0, health - amount)
    health_changed.emit(health)
    if health == 0:
        await get_tree().create_timer(0.5).timeout
        queue_free()

func shoot() -> void:
    var bullet := bullet_scene.instantiate()
    get_parent().add_child(bullet)
    bullet.global_position = global_position
```

```gdscript
# project.godot autoloads: "GameState" -> "res://scripts/game_state.gd"
# game_state.gd
extends Node
var score: int = 0
func add_score(points: int) -> void:
    score += points
```

## Key patterns

### Signals
Declare with `signal name(arg: Type)`, emit with `name.emit(value)`, connect with `node.name.connect(callable)` or visually in the editor. Prefer signals over polling for one-shot events.

### Exported variables
`@export var speed: float = 5.0` exposes a tweakable field in the Inspector. Use `@export_range`, `@export_file`, `@export_node_path` for typed editors.

### Scene composition
Build small reusable scenes (`enemy.tscn`, `bullet.tscn`) and instance them at runtime via `PackedScene.instantiate()`. Avoid one mega-scene; use sub-scenes for encapsulation.

### Physics layers and masks
A body's `collision_layer` describes what it is; `collision_mask` describes what it scans for. Enemies might be on layer 2, the player on layer 1, with masks set so they collide but enemies ignore each other.

### Animation
`AnimationPlayer` for authored keyframed clips, `AnimationTree` for state machines and blending, `Tween` (`create_tween()`) for runtime procedural animations like UI fades and easings.

### Autoloads
Project Settings > Autoload registers a scene or script as a global singleton accessible by name from any script (`GameState.score`). Good for input remapping, audio buses, persistent data.

### GDScript vs C#
Use GDScript by default: tight engine integration, fast iteration, no extra build step. Use C# when you need raw CPU performance for game logic, reuse existing .NET libraries, or your team prefers static tooling. Mixing both in one project is supported.

## Common pitfalls

- Putting movement in `_process` instead of `_physics_process`; physics needs the fixed timestep.
- Using `get_node("Path")` with brittle string paths; prefer `@onready var foo := $Foo` or unique-name nodes (`%Foo`).
- Forgetting to call `queue_free()` and leaking instanced scenes.
- Using `Input.is_action_pressed` for one-shot events instead of `Input.is_action_just_pressed`.
- Misconfiguring collision layers so signals like `body_entered` never fire.
- Writing untyped GDScript everywhere; the static analyzer catches more bugs when you annotate types.
- Editing exported variables only in code; the Inspector value overrides the script default on saved scenes.
- Treating autoloads as a dumping ground for everything global; coupling explodes.

## Reference

- Official docs: https://docs.godotengine.org/en/stable/
- GDScript reference: https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/gdscript_basics.html
- C# in Godot: https://docs.godotengine.org/en/stable/tutorials/scripting/c_sharp/index.html
- Related: [[unity-csharp-gamedev]]
