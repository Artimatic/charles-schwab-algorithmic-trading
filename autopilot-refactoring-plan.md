# Autopilot Module: Refactoring & Architecture Plan

This document outlines a phased approach to implementing the identified improvements within the `AutopilotComponent` and `AutopilotService`. The plan prioritizes critical runtime bugs and stability first, followed by structural decoupling, and finally, broader architectural state management enhancements.

## Phase 1: Critical Fixes & Stability (High Priority)
*Targeting immediate runtime risks, memory leaks, and concurrency issues. These should be addressed in the next sprint.*

### 1. Resolve Asynchronous Execution in Loops
*   **Issue:** `forEach` loops containing `await` (e.g., in `addToCurrentPositions`, `sellLoser`, `sellPutLoser`) execute synchronously, causing race conditions where orders process out of expected sequence.
*   **Action:** Refactor all instances of `array.forEach(async () => {})` to use `for...of` loops for sequential execution, or `Promise.all(array.map(...))` for concurrent execution when order dependency is not a factor.

### 2. Standardize Subscription Teardown
*   **Issue:** The manual assignment and cleanup of the `timer` subscription in `AutopilotComponent` (`this.timer.unsubscribe()`) is prone to memory leaks if component destruction occurs unexpectedly.
*   **Action:** Refactor all RxJS subscriptions to uniformly use the declarative `takeUntil(this.destroy$)` pattern. Ensure `this.timer` is handled within this standard teardown flow.

### 3. Eliminate Implicit `any` Types
*   **Issue:** Bypassing strict typing (e.g., `(this as any)._testTimeouts`, `marketHour: any`) reduces compiler safety and code intelligence.
*   **Action:** Define strict TypeScript interfaces for `MarketHours`, `OrderTypes`, and component class extensions. This improves tooling support and prevents runtime property access errors.

---

## Phase 2: Core Refactoring & Decoupling (Medium Priority)
*Targeting testability, separation of concerns, and modularity.*

### 1. Abstract Browser APIs (`localStorage`)
*   **Issue:** Direct calls to `localStorage` in `AutopilotService` break Dependency Inversion principles and hinder testability.
*   **Action:** Create an injectable `StorageService` or use an Angular `InjectionToken` for local storage interaction. This allows for easy mocking in unit tests and ensures safety in non-browser execution contexts.

### 2. Implement the Strategy Pattern for Trade Execution
*   **Issue:** The massive `switch` statement in `handleStrategy` violates the Open-Closed Principle and creates a severe bottleneck for future strategy additions.
*   **Action:** 
    *   Define a common interface: `ITradingStrategy { execute(holdings: PortfolioInfoHolding[]): Promise<void>; }`
    *   Extract each case (e.g., `MLPairs`, `BuyMfiTrade`) into its own isolated class implementing the interface.
    *   Inject these strategies using Angular's dependency injection system, allowing the service to iterate and execute without modifying the core orchestrator when new algorithms are introduced.

### 3. Extract the Testing Sandbox
*   **Issue:** The 100+ line `test()` method heavily pollutes the presentation component with mock lifecycle executions.
*   **Action:** Relocate this logic to a dedicated `MockTradingService` or extract it completely into an E2E testing suite (e.g., Cypress/Playwright). If a UI "sandbox mode" is required, route this through a dedicated isolated testing component, keeping the primary `AutopilotComponent` strictly tied to live behavior.

---

## Phase 3: Architectural Overhaul & State Management (Strategic / Long-Term)
*Targeting component bloat and preparing the module for scalable enterprise contexts.*

### 1. Implement a Facade Pattern
*   **Issue:** `AutopilotComponent` suffers from the "God Component" anti-pattern, injecting over 15 distinct services, tightly coupling the view to the entire data layer.
*   **Action:** Introduce an `AutopilotFacade` service. The component should only inject this single Facade, which then coordinates with the underlying cart, portfolio, strategy, and options services. This dramatically simplifies the component's constructor and pushes business orchestration strictly to the service layer.

### 2. Centralize State Management
*   **Issue:** Mutable state arrays (like `currentHoldings` and `strategyList`) are modified directly across the application, making the data flow difficult to track and prone to race conditions.
*   **Action:** Migrate state to a reactive model. Whether utilizing a full NgRx store, component store, or Angular Signals, state should flow in one direction and remain immutable. Centralizing the state makes it highly predictable and scales smoothly, providing a strong architectural foundation if this trading module is ever packaged, shared, or consumed within a broader micro-frontend architecture or an Nx monorepo environment.
