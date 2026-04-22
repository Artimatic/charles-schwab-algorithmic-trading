# PrimeNG to Angular Material Migration Plan

## Overview
This document outlines the systematic migration from PrimeNG to Angular Material for the Charles Schwab Algorithmic Trading application.

## Current State
- **PrimeNG Version**: 11.4.5
- **Angular Material Version**: 11.2.13 (already installed)
- **Files Affected**: 60+ component files
- **PrimeNG Components**: 400+ instances across 45+ modules

## Migration Strategy
1. **Phase 1**: Core Infrastructure (Services, Modules, Styling)
2. **Phase 2**: High-Priority Components (Buttons, Inputs, Tables)
3. **Phase 3**: Medium-Priority Components (Dialogs, Cards, Lists)
4. **Phase 4**: Low-Priority Components (Advanced features, Timeline)
5. **Phase 5**: Cleanup and Testing

## Component Mapping

### Services
| PrimeNG | Angular Material | Notes |
|---------|------------------|-------|
| MessageService | MatSnackBar | Toast notifications |
| DialogService | MatDialog | Modal dialogs |
| SelectItem | MatOption | Select options |
| MenuItem | MatMenuItem | Menu items |
| DynamicDialogRef | MatDialogRef | Dialog references |

### Modules
| PrimeNG | Angular Material | Status |
|---------|------------------|--------|
| ToastModule | MatSnackBarModule | ✅ Ready |
| InputTextModule | MatInputModule | ✅ Ready |
| ToolbarModule | MatToolbarModule | ✅ Ready |
| TooltipModule | MatTooltipModule | ✅ Ready |
| TabMenuModule | MatTabsModule | ✅ Ready |
| OverlayPanelModule | MatMenuModule | ✅ Ready |
| DynamicDialogModule | MatDialogModule | ✅ Ready |
| PasswordModule | MatInputModule | ✅ Ready |
| CheckboxModule | MatCheckboxModule | ✅ Ready |
| InputTextareaModule | MatInputModule | ✅ Ready |
| PickListModule | MatSelectionList | ⚠️ Custom implementation needed |
| TimelineModule | MatStepperModule | ⚠️ Custom implementation needed |
| DataViewModule | MatTableModule | ✅ Ready |
| RippleModule | MatRippleModule | ✅ Ready |
| TableModule | MatTableModule | ✅ Ready |
| MultiSelectModule | MatSelectModule | ✅ Ready |
| SelectButtonModule | MatButtonToggleModule | ✅ Ready |
| ListboxModule | MatSelectionList | ✅ Ready |
| DialogModule | MatDialogModule | ✅ Ready |
| SpinnerModule | MatInputModule | ✅ Ready |
| DropdownModule | MatSelectModule | ✅ Ready |
| CardModule | MatCardModule | ✅ Ready |
| ButtonModule | MatButtonModule | ✅ Ready |
| SplitButtonModule | MatMenuModule + MatButtonModule | ⚠️ Custom implementation needed |
| StepsModule | MatStepperModule | ✅ Ready |
| ChartModule | - | ⚠️ Keep existing Chart.js integration |
| ProgressSpinnerModule | MatProgressSpinnerModule | ✅ Ready |
| InputSwitchModule | MatSlideToggleModule | ✅ Ready |
| FieldsetModule | MatExpansionModule | ✅ Ready |
| ChipModule | MatChipsModule | ✅ Ready |
| ProgressBarModule | MatProgressBarModule | ✅ Ready |
| AutoCompleteModule | MatAutocompleteModule | ✅ Ready |
| RadioButtonModule | MatRadioModule | ✅ Ready |
| AccordionModule | MatExpansionModule | ✅ Ready |
| InputNumberModule | MatInputModule | ✅ Ready |
| TagModule | MatChipsModule | ✅ Ready |
| AvatarModule | - | ⚠️ Custom implementation needed |
| AvatarGroupModule | - | ⚠️ Custom implementation needed |
| OrderListModule | - | ⚠️ Custom implementation needed |
| MenubarModule | MatToolbarModule + MatMenuModule | ✅ Ready |

### Components
| PrimeNG | Angular Material | Migration Notes |
|---------|------------------|----------------|
| `<p-button>` | `<button mat-button>` | Update attributes and classes |
| `<p-table>` | `<table mat-table>` | Complex - requires data source changes |
| `<p-card>` | `<mat-card>` | Simple replacement |
| `<p-dropdown>` | `<mat-select>` | Update option structure |
| `<p-dialog>` | `<mat-dialog>` | Update dialog structure |
| `<p-tag>` | `<mat-chip>` | Update severity attributes |
| `<p-splitButton>` | Custom with `<mat-menu>` | Requires custom implementation |
| `<p-inputSwitch>` | `<mat-slide-toggle>` | Simple replacement |
| `<p-inputNumber>` | `<input matInput type="number">` | Add form field wrapper |
| `<p-chip>` | `<mat-chip>` | Simple replacement |
| `<p-listbox>` | `<mat-selection-list>` | Update option structure |
| `<p-selectButton>` | `<mat-button-toggle-group>` | Update structure |
| `<p-autoComplete>` | `<input matInput [matAutocomplete]="auto">` | Requires mat-autocomplete |
| `<p-pickList>` | Custom implementation | Complex dual-list component |
| `<p-timeline>` | Custom with CSS | Requires custom timeline component |
| `<p-progressBar>` | `<mat-progress-bar>` | Simple replacement |
| `<p-spinner>` | `<mat-progress-spinner>` | Simple replacement |
| `<p-multiSelect>` | `<mat-select multiple>` | Update option structure |
| `<p-fieldset>` | `<mat-expansion-panel>` | Update structure |
| `<p-toast>` | `<mat-snack-bar>` | Service-based replacement |
| `<p-menubar>` | `<mat-toolbar>` + `<mat-menu>` | Update menu structure |

## Implementation Phases

### Phase 1: Infrastructure Setup
- [ ] Update Angular Material to latest compatible version
- [ ] Add Material theme to angular.json
- [ ] Remove PrimeNG CSS imports from styles.css
- [ ] Update app.module.ts with Material modules
- [ ] Replace MessageService with MatSnackBar
- [ ] Replace DialogService with MatDialog

### Phase 2: Core Components (High Priority)
- [ ] Buttons (`p-button` → `mat-button`)
- [ ] Inputs (`p-inputText` → `matInput`)
- [ ] Tables (`p-table` → `mat-table`)
- [ ] Cards (`p-card` → `mat-card`)
- [ ] Dropdowns (`p-dropdown` → `mat-select`)

### Phase 3: UI Components (Medium Priority)
- [ ] Dialogs (`p-dialog` → `mat-dialog`)
- [ ] Tags/Chips (`p-tag` → `mat-chip`)
- [ ] Checkboxes and toggles
- [ ] Progress indicators
- [ ] Form controls

### Phase 4: Advanced Components (Low Priority)
- [ ] Timeline components
- [ ] Pick lists
- [ ] Complex tables with editing
- [ ] Custom components

### Phase 5: Cleanup
- [ ] Remove PrimeNG dependencies
- [ ] Update custom CSS
- [ ] Test all functionality
- [ ] Update documentation

## Risk Assessment
- **High Risk**: Table components with complex features (inline editing, templates)
- **Medium Risk**: Dialog service integration, custom styling
- **Low Risk**: Basic components (buttons, inputs, cards)

## Testing Strategy
- Unit tests for each migrated component
- Integration tests for complex features
- End-to-end tests for critical user flows
- Visual regression testing for UI consistency</content>
<parameter name="filePath">c:\Users\dvxch\Documents\GitHub\charles-schwab-algorithmic-trading\PRIMENG_MIGRATION_PLAN.md