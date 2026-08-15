"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const GEO_LOG = "[FarmCompass][Geolocation]";

function sameCoords(
  a: GeolocationCoordinates | undefined,
  b: GeolocationCoordinates | undefined,
) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.accuracy === b.accuracy &&
    a.altitude === b.altitude &&
    a.altitudeAccuracy === b.altitudeAccuracy &&
    a.heading === b.heading &&
    a.latitude === b.latitude &&
    a.longitude === b.longitude &&
    a.speed === b.speed
  );
}

type PolicyInspector = {
  allowsFeature?: (feature: string) => boolean;
  allowedFeatures?: () => string[];
};

function getPolicyDebug() {
  if (typeof document === "undefined") {
    return {
      policyApi: "unavailable",
      geolocationAllowedByDocumentPolicy: null as boolean | null,
      allowedFeatures: null as string[] | null,
    };
  }

  const doc = document as Document & {
    permissionsPolicy?: PolicyInspector;
    featurePolicy?: PolicyInspector;
  };

  const policy = doc.permissionsPolicy ?? doc.featurePolicy;

  if (!policy) {
    return {
      policyApi: "not-supported",
      geolocationAllowedByDocumentPolicy: null as boolean | null,
      allowedFeatures: null as string[] | null,
    };
  }

  let geolocationAllowedByDocumentPolicy: boolean | null = null;
  let allowedFeatures: string[] | null = null;

  try {
    geolocationAllowedByDocumentPolicy =
      typeof policy.allowsFeature === "function"
        ? policy.allowsFeature("geolocation")
        : null;
  } catch (error) {
    console.warn(`${GEO_LOG} Unable to inspect geolocation Permissions Policy`, error);
  }

  try {
    allowedFeatures =
      typeof policy.allowedFeatures === "function"
        ? policy.allowedFeatures()
        : null;
  } catch (error) {
    console.warn(`${GEO_LOG} Unable to list Permissions Policy features`, error);
  }

  return {
    policyApi: doc.permissionsPolicy ? "permissionsPolicy" : "featurePolicy",
    geolocationAllowedByDocumentPolicy,
    allowedFeatures,
  };
}

function getEnvironmentDebug() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      origin: "server",
      secureContext: false,
      geolocationApiAvailable: false,
      ...getPolicyDebug(),
    };
  }

  return {
    origin: window.location.origin,
    href: window.location.href,
    secureContext: window.isSecureContext,
    geolocationApiAvailable: Boolean(navigator.geolocation),
    permissionsApiAvailable: Boolean(navigator.permissions),
    userAgent: navigator.userAgent,
    ...getPolicyDebug(),
  };
}

export interface GeolocatedConfig {
  positionOptions?: PositionOptions;
  userDecisionTimeout?: number;
  geolocationProvider?: Geolocation;
  suppressLocationOnMount?: boolean;
  watchPosition?: boolean;
  isOptimisticGeolocationEnabled?: boolean;
  watchLocationPermissionChange?: boolean;
  onError?: (positionError?: GeolocationPositionError) => void;
  onSuccess?: (position: GeolocationPosition) => void;
}

export interface GeolocatedResult {
  coords: GeolocationCoordinates | undefined;
  timestamp: EpochTimeStamp | undefined;
  isGeolocationAvailable: boolean;
  isGeolocationEnabled: boolean;
  positionError: GeolocationPositionError | undefined;
  getPosition: () => void;
}

export function useGeolocated(config: GeolocatedConfig = {}): GeolocatedResult {
  const {
    positionOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: Infinity,
    },
    isOptimisticGeolocationEnabled = true,
    userDecisionTimeout,
    suppressLocationOnMount = false,
    watchPosition = false,
    geolocationProvider =
      typeof navigator !== "undefined" ? navigator.geolocation : undefined,
    watchLocationPermissionChange = false,
    onError,
    onSuccess,
  } = config;

  const userDecisionTimeoutId = useRef(0);
  const isCurrentlyMounted = useRef(true);
  const watchId = useRef<number>(0);

  const [isGeolocationEnabled, setIsGeolocationEnabled] = useState(
    isOptimisticGeolocationEnabled,
  );
  const [coords, setCoords] = useState<GeolocationCoordinates | undefined>();
  const [timestamp, setTimestamp] = useState<EpochTimeStamp | undefined>();
  const [positionError, setPositionError] = useState<
    GeolocationPositionError | undefined
  >();
  const [permissionState, setPermissionState] = useState<
    PermissionState | undefined
  >();

  const updateCoords = useCallback((next?: GeolocationCoordinates) => {
    setCoords((prev) => (sameCoords(prev, next) ? prev : next));
  }, []);

  const cancelUserDecisionTimeout = useCallback(() => {
    if (userDecisionTimeoutId.current) {
      window.clearTimeout(userDecisionTimeoutId.current);
      userDecisionTimeoutId.current = 0;
      console.debug(`${GEO_LOG} Cleared user-decision timeout`);
    }
  }, []);

  const handlePositionError = useCallback(
    (error?: GeolocationPositionError) => {
      cancelUserDecisionTimeout();

      const errorName =
        !error
          ? "USER_DECISION_TIMEOUT"
          : error.code === 1
            ? "PERMISSION_DENIED"
            : error.code === 2
              ? "POSITION_UNAVAILABLE"
              : error.code === 3
                ? "TIMEOUT"
                : `UNKNOWN_${error.code}`;

      console.error(`${GEO_LOG} Position request failed`, {
        errorName,
        code: error?.code,
        message: error?.message,
        permissionState,
        environment: getEnvironmentDebug(),
      });

      if (isCurrentlyMounted.current) {
        setCoords(undefined);
        setPositionError(error);

        // Only an actual PERMISSION_DENIED response proves that geolocation
        // access is disabled. A timeout or unavailable position is not a
        // permission denial.
        if (error?.code === 1) {
          setIsGeolocationEnabled(false);
        }
      }

      onError?.(error);
    },
    [onError, cancelUserDecisionTimeout, permissionState],
  );

  const handlePositionSuccess = useCallback(
    (position: GeolocationPosition) => {
      cancelUserDecisionTimeout();

      console.info(`${GEO_LOG} Position acquired`, {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        altitude: position.coords.altitude,
        accuracy: position.coords.accuracy,
        altitudeAccuracy: position.coords.altitudeAccuracy,
        heading: position.coords.heading,
        speed: position.coords.speed,
        timestamp: position.timestamp,
        permissionState,
        environment: getEnvironmentDebug(),
      });

      if (isCurrentlyMounted.current) {
        updateCoords(position.coords);
        setTimestamp(position.timestamp);
        setIsGeolocationEnabled(true);
        setPositionError(undefined);
      }

      onSuccess?.(position);
    },
    [onSuccess, cancelUserDecisionTimeout, updateCoords, permissionState],
  );

  const getPosition = useCallback(() => {
    const environment = getEnvironmentDebug();

    console.groupCollapsed(`${GEO_LOG} getPosition()`);
    console.log("Environment", environment);
    console.log("Permission state", permissionState ?? "unknown/not-yet-read");
    console.log("Position options", positionOptions);
    console.log("Watch position", watchPosition);
    console.log("Provider", geolocationProvider);
    console.groupEnd();

    if (!environment.secureContext) {
      console.error(
        `${GEO_LOG} Geolocation requires a secure context (HTTPS), except localhost development.`,
      );
    }

    if (environment.geolocationAllowedByDocumentPolicy === false) {
      console.error(
        `${GEO_LOG} BLOCKED BY DOCUMENT PERMISSIONS POLICY. The browser will reject getCurrentPosition() even if the site permission is set to Allow.`,
        environment,
      );
    }

    if (
      !geolocationProvider?.getCurrentPosition ||
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      !geolocationProvider.watchPosition
    ) {
      console.error(`${GEO_LOG} Invalid or unavailable Geolocation provider`);
      throw new Error("The provided geolocation provider is invalid");
    }

    if (userDecisionTimeout && permissionState !== "granted") {
      console.debug(`${GEO_LOG} Starting user-decision timeout`, {
        milliseconds: userDecisionTimeout,
      });
      userDecisionTimeoutId.current = window.setTimeout(() => {
        console.warn(`${GEO_LOG} User-decision timeout elapsed`);
        handlePositionError();
      }, userDecisionTimeout);
    }

    if (watchPosition) {
      console.debug(`${GEO_LOG} Calling navigator.geolocation.watchPosition()`);
      watchId.current = geolocationProvider.watchPosition(
        handlePositionSuccess,
        handlePositionError,
        positionOptions,
      );
    } else {
      console.debug(
        `${GEO_LOG} Calling navigator.geolocation.getCurrentPosition()`,
      );
      geolocationProvider.getCurrentPosition(
        handlePositionSuccess,
        handlePositionError,
        positionOptions,
      );
    }
  }, [
    geolocationProvider,
    watchPosition,
    userDecisionTimeout,
    handlePositionError,
    handlePositionSuccess,
    positionOptions,
    permissionState,
  ]);

  useEffect(() => {
    isCurrentlyMounted.current = true;
    console.info(`${GEO_LOG} Hook mounted`, getEnvironmentDebug());

    return () => {
      isCurrentlyMounted.current = false;
      console.info(`${GEO_LOG} Hook unmounted`);
    };
  }, []);

  useEffect(() => {
    let permission: PermissionStatus | undefined;

    if (
      watchLocationPermissionChange &&
      geolocationProvider &&
      typeof navigator !== "undefined" &&
      "permissions" in navigator
    ) {
      console.debug(`${GEO_LOG} Querying browser geolocation permission state`);

      navigator.permissions
        .query({ name: "geolocation" })
        .then((result) => {
          permission = result;

          // Important: capture the CURRENT state immediately, not only later
          // changes. This lets the hook distinguish granted/prompt/denied.
          setPermissionState(result.state);
          setIsGeolocationEnabled(result.state !== "denied");

          console.info(`${GEO_LOG} Browser permission query result`, {
            state: result.state,
            environment: getEnvironmentDebug(),
          });

          permission.onchange = () => {
            if (!permission) return;
            console.info(`${GEO_LOG} Browser geolocation permission changed`, {
              state: permission.state,
              environment: getEnvironmentDebug(),
            });
            setPermissionState(permission.state);
            setIsGeolocationEnabled(permission.state !== "denied");
          };
        })
        .catch((error: unknown) => {
          console.error(`${GEO_LOG} Permissions API query failed`, error);
        });
    } else {
      console.debug(`${GEO_LOG} Permissions API monitoring not enabled`, {
        watchLocationPermissionChange,
        geolocationProviderAvailable: Boolean(geolocationProvider),
        permissionsApiAvailable:
          typeof navigator !== "undefined" && "permissions" in navigator,
      });
    }

    return () => {
      if (permission) permission.onchange = null;
    };
  }, [geolocationProvider, watchLocationPermissionChange]);

  useEffect(() => {
    if (!suppressLocationOnMount) {
      console.debug(`${GEO_LOG} Auto-requesting location on mount`);
      getPosition();
    } else {
      console.debug(`${GEO_LOG} Location-on-mount suppressed; waiting for button click`);
    }

    return () => {
      cancelUserDecisionTimeout();
      if (watchPosition && watchId.current) {
        console.debug(`${GEO_LOG} Clearing geolocation watch`, watchId.current);
        geolocationProvider?.clearWatch(watchId.current);
      }
    };
    // Re-run when permission state changes to preserve the behavior of the
    // supplied hook while keeping the logs visible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionState]);

  return {
    getPosition,
    coords,
    timestamp,
    isGeolocationEnabled,
    isGeolocationAvailable: Boolean(geolocationProvider),
    positionError,
  };
}
