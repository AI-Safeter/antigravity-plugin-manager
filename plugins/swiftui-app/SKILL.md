---
name: swiftui-app
description: SwiftUI for iOS 17+ and macOS 14+ apps. Covers declarative views, the @Observable macro and the older @State/@Binding/@StateObject family, NavigationStack, environment values, async data loading with .task, sheet/alert/fullScreenCover modifiers, and Xcode Previews. Use this skill when building, refactoring, or debugging SwiftUI user interfaces on Apple platforms.
---

# SwiftUI App

SwiftUI is Apple's declarative UI framework. Views are value types (structs) that describe state-driven UI; SwiftUI re-renders them when their observed state changes. iOS 17 introduced the `@Observable` macro which simplifies the prior `ObservableObject` / `@Published` boilerplate.

## Use this skill when

- Building iOS, iPadOS, macOS, watchOS, visionOS, or tvOS UI in SwiftUI
- Wiring state with `@State`, `@Binding`, `@Environment`, or `@Observable`
- Adding navigation with `NavigationStack` and value-based destinations
- Loading async data with `.task` and cancelling on view disappear
- Presenting sheets, alerts, confirmation dialogs, and inspectors
- Authoring Xcode Previews for design iteration

## Do not use this skill when

- Targeting iOS 13-16 only with no `@Observable` available (use the legacy ObservableObject patterns instead)
- Building a UIKit-only app with no SwiftUI hosting
- Writing pure model/business logic without UI

## Core concepts

State ownership flows downward: a parent owns state (`@State` or `@Observable` model) and passes read-only values down or `@Binding` for two-way edits. The `@Observable` macro replaces `ObservableObject` + `@Published`; consumers use plain `let` or `@Bindable` instead of `@StateObject`/`@ObservedObject`. Views are cheap to recreate; the framework diffs them.

## Quick start

```swift
import SwiftUI

@Observable
final class CounterModel {
    var count = 0
    func increment() { count += 1 }
}

struct ContentView: View {
    @State private var model = CounterModel()
    @State private var showSheet = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                Text("Count: \(model.count)")
                    .font(.largeTitle)
                Button("Increment") { model.increment() }
                Button("Details") { showSheet = true }
            }
            .padding()
            .navigationTitle("Counter")
            .task { await loadInitial() }
            .sheet(isPresented: $showSheet) {
                DetailView(model: model)
            }
        }
    }

    func loadInitial() async {
        // async work; cancelled automatically when view disappears
    }
}

struct DetailView: View {
    @Bindable var model: CounterModel
    var body: some View {
        Stepper("Count: \(model.count)", value: $model.count)
            .padding()
    }
}

#Preview { ContentView() }
```

## Key patterns

### State ownership
- `@State` owns local value-type state inside a single view.
- `@Binding` exposes a parent's state to a child for read/write.
- `@Observable` model + `@State` at the root + `@Bindable` in children replaces the old `@StateObject`/`@ObservedObject` split for iOS 17+.
- `@Environment(\.dismiss)`, `@Environment(\.scenePhase)` for system-provided values.

### Navigation
```swift
NavigationStack(path: $path) {
    List(items) { item in
        NavigationLink(value: item) { Text(item.title) }
    }
    .navigationDestination(for: Item.self) { ItemDetail(item: $0) }
}
```
Type-safe destinations are easier to deep link than the legacy `NavigationView`.

### Async data with .task
`.task { await load() }` ties an async block to view lifetime; SwiftUI cancels it on disappear. Use `.task(id: query)` to re-run when an input changes.

### Presentation modifiers
`.sheet(isPresented:)`, `.sheet(item:)`, `.alert(_:isPresented:)`, `.confirmationDialog`, `.fullScreenCover`, `.inspector`.

### Previews
`#Preview("Empty") { ContentView().environment(EmptyStore()) }` lets you stub environment, locale, and color scheme without launching the simulator.

## Common pitfalls

- Mixing `@StateObject` (owns) and `@ObservedObject` (borrows) incorrectly; under `@Observable` use `@State` to own and `@Bindable` to bind.
- Putting heavy computation in `body`; SwiftUI may call it many times. Cache in the model.
- Forgetting that `body` re-runs invalidate `.task` only when its `id:` changes; without `id:` the task does not re-run.
- Using `NavigationView` in new code; it's deprecated in favor of `NavigationStack`/`NavigationSplitView`.
- Animations not running because state is mutated outside `withAnimation { }`.
- Sharing models across windows/scenes without `.environment(model)` plumbing.
- Building giant view bodies; the type checker times out. Extract subviews.
- Calling `@MainActor` UI updates from a background task without hopping back to the main actor.

## Reference

- Official docs: https://developer.apple.com/documentation/swiftui
- Observation framework: https://developer.apple.com/documentation/observation
- Related: [[jetpack-compose]]
