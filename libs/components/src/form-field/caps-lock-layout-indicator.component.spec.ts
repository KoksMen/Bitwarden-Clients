import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils/i18n-mock.service";

import { BitCapsLockLayoutIndicatorComponent } from "./caps-lock-layout-indicator.component";

describe("BitCapsLockLayoutIndicatorComponent", () => {
  let fixture: ComponentFixture<BitCapsLockLayoutIndicatorComponent>;
  let component: BitCapsLockLayoutIndicatorComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BitCapsLockLayoutIndicatorComponent],
      providers: [
        {
          provide: I18nService,
          useValue: new I18nMockService({
            capsLockOn: "Caps Lock is on",
            keyboardLayout: "Layout",
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BitCapsLockLayoutIndicatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it("creates component", () => {
    expect(component).toBeTruthy();
  });

  it("updates caps lock state on keydown event", () => {
    const event = new KeyboardEvent("keydown", {
      key: "a",
      modifierCapsLock: true,
    });
    window.dispatchEvent(event);
    fixture.detectChanges();

    expect(component.capsLock()).toBe(true);
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain("Caps Lock is on");
  });

  it("detects Cyrillic layout on typing Russian characters", () => {
    const event = new KeyboardEvent("keydown", {
      key: "ф",
      code: "KeyA",
    });
    window.dispatchEvent(event);
    fixture.detectChanges();

    expect(component.layout()).toBe("RU");
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain("RU");
  });

  it("detects Latin layout on typing English characters", () => {
    component.layout.set("RU");
    const event = new KeyboardEvent("keydown", {
      key: "a",
      code: "KeyA",
    });
    window.dispatchEvent(event);
    fixture.detectChanges();

    expect(component.layout()).toBe("EN");
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain("EN");
  });
});
