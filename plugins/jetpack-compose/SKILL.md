---
name: jetpack-compose
description: Jetpack Compose for Android UI. Covers composable functions, state hoisting, remember and mutableStateOf, side-effect APIs (LaunchedEffect, DisposableEffect, rememberCoroutineScope, produceState), Material 3 components and theming, Compose Navigation with type-safe routes, and previews. Use this skill when building or refactoring Android UI in Kotlin with Jetpack Compose.
---

# Jetpack Compose

Jetpack Compose is Android's declarative UI toolkit in Kotlin. Composable functions describe UI as a function of state; the runtime tracks reads and recomposes only the affected scopes. State is held in `MutableState` and survives recomposition via `remember`.

## Use this skill when

- Building a new Android UI screen with `@Composable` functions
- Hoisting state from a composable to a ViewModel or parent
- Wiring side effects with `LaunchedEffect`, `DisposableEffect`, or `produceState`
- Styling with Material 3 (`MaterialTheme`, `ColorScheme`, `Typography`)
- Setting up Compose Navigation with `NavHost` and typed destinations
- Authoring `@Preview` composables for design iteration

## Do not use this skill when

- Maintaining a legacy XML/View-system Android app with no Compose interop planned
- Writing Compose Multiplatform UI for non-Android targets (use the Compose Multiplatform skill if available)
- Building pure Kotlin domain code with no UI concerns

## Core concepts

A composable is a function annotated `@Composable`. It can call other composables and emit UI. State must be remembered across recompositions with `remember { mutableStateOf(...) }` (or hoisted to a `ViewModel`). Side effects that touch non-Compose code go inside `LaunchedEffect`, `DisposableEffect`, or `SideEffect` so they cooperate with composition lifecycle.

## Quick start

```kotlin
@Composable
fun CounterScreen(viewModel: CounterViewModel = viewModel()) {
    val count by viewModel.count.collectAsStateWithLifecycle()

    Scaffold(
        topBar = { TopAppBar(title = { Text("Counter") }) }
    ) { padding ->
        Column(
            modifier = Modifier.padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Count: $count", style = MaterialTheme.typography.headlineMedium)
            Button(onClick = viewModel::increment) { Text("Increment") }
        }
    }

    LaunchedEffect(Unit) { viewModel.load() }
}

class CounterViewModel : ViewModel() {
    private val _count = MutableStateFlow(0)
    val count: StateFlow<Int> = _count.asStateFlow()
    fun increment() { _count.value += 1 }
    suspend fun load() { /* fetch initial */ }
}

@Preview(showBackground = true)
@Composable
fun CounterPreview() {
    MaterialTheme { CounterScreen() }
}
```

## Key patterns

### State hoisting
A composable should be stateless when possible: take the value plus a callback (`value: T, onValueChange: (T) -> Unit`). The owner (parent or ViewModel) holds the state. This makes the composable testable and reusable.

### remember and rememberSaveable
`remember { mutableStateOf(0) }` survives recomposition but not process death. `rememberSaveable` persists across configuration change and process recreation for `Parcelable`/primitive state.

### Side effects
- `LaunchedEffect(key) { ... }` launches a coroutine tied to composition; relaunches when `key` changes.
- `DisposableEffect(key) { onDispose { ... } }` for resources that need cleanup (listeners, callbacks).
- `produceState(initial) { value = fetch() }` collects async into a Compose `State`.
- `rememberCoroutineScope()` for scopes tied to event handlers.

### Material 3
Provide `MaterialTheme(colorScheme = ..., typography = ...)` at the root. Use `dynamicLightColorScheme(context)` on Android 12+ for system-tinted palettes. Surfaces, cards, buttons, and text fields read these tokens.

### Navigation
```kotlin
NavHost(navController, startDestination = "list") {
    composable("list") { ListScreen(onItem = { navController.navigate("detail/$it") }) }
    composable("detail/{id}") { back ->
        DetailScreen(id = back.arguments?.getString("id") ?: "")
    }
}
```
Type-safe destinations are available with `navigation-compose` 2.8+ using `@Serializable` route classes.

## Common pitfalls

- Forgetting `remember`: `val state = mutableStateOf(0)` resets on every recomposition.
- Reading state inside lambdas without `by` then expecting recomposition; use `val x by state` or `state.value`.
- Heavy work inside `@Composable` functions; recomposition runs the function body, sometimes often. Move work to `LaunchedEffect` or the ViewModel.
- Collecting flows with `collectAsState()` instead of `collectAsStateWithLifecycle()`, which respects lifecycle and avoids work in the background.
- Mutating shared state from a composable directly instead of through the ViewModel; breaks unidirectional data flow.
- Using `Modifier` order incorrectly: `Modifier.padding(8.dp).background(Color.Red)` paints a smaller red region than `background` first.
- Not keying `LazyColumn` items, causing extra recomposition on insert/delete.

## Reference

- Official docs: https://developer.android.com/jetpack/compose
- Compose side effects: https://developer.android.com/jetpack/compose/side-effects
- Related: [[swiftui-app]]
