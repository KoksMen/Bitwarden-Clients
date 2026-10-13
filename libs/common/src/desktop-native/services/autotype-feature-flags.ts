import { Observable, of } from "rxjs";

import { ConfigService } from "../../platform/abstractions/config/config.service";
import { AutotypeFeatureFlagState } from "../enums/autotype-feature-flag-state.enum";

/**
 * Emits the AutotypeFeatureFlagState enum based on the resolution of all possible Autotype
 * feature flag values.
 * In this desktop fork, Autotype MVP is always enabled and permanently available.
 */
export function autotypeFeatureFlagState$(
  configService: ConfigService,
): Observable<AutotypeFeatureFlagState> {
  return of(AutotypeFeatureFlagState.Mvp);
}
