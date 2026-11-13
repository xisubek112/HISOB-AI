package uz.hisobotai.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Native runtime permission bridge for HISOBOT AI.
 * Provides Android RECORD_AUDIO runtime checks/requests (used by Voice AI),
 * rationale detection for permanently denied state, and hardware capability probes.
 */
@CapacitorPlugin(
    name = "HisobotPermissions",
    permissions = {
        @Permission(
            strings = { Manifest.permission.RECORD_AUDIO },
            alias = "microphone"
        )
    }
)
public class HisobotPermissionsPlugin extends Plugin {

    private static final String ALIAS_MICROPHONE = "microphone";

    private boolean hasHardwareMicrophone() {
        return getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_MICROPHONE);
    }

    private boolean isMicrophoneGranted() {
        return ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED;
    }

    private JSObject buildMicrophonePayload(boolean wasRequested) {
        JSObject ret = new JSObject();
        ret.put("androidSdk", Build.VERSION.SDK_INT);

        if (!hasHardwareMicrophone()) {
            ret.put("status", "unavailable");
            ret.put("permanentlyDenied", false);
            return ret;
        }

        if (isMicrophoneGranted() || getPermissionState(ALIAS_MICROPHONE) == PermissionState.GRANTED) {
            ret.put("status", "granted");
            ret.put("permanentlyDenied", false);
            return ret;
        }

        boolean showRationale = ActivityCompat.shouldShowRequestPermissionRationale(
            getActivity(),
            Manifest.permission.RECORD_AUDIO
        );

        if (wasRequested && !showRationale) {
            ret.put("status", "permanently_denied");
            ret.put("permanentlyDenied", true);
        } else if (wasRequested) {
            ret.put("status", "denied");
            ret.put("permanentlyDenied", false);
        } else {
            ret.put("status", "prompt");
            ret.put("permanentlyDenied", false);
        }
        return ret;
    }

    @PluginMethod
    public void checkMicrophone(PluginCall call) {
        call.resolve(buildMicrophonePayload(false));
    }

    @PluginMethod
    public void requestMicrophone(PluginCall call) {
        if (!hasHardwareMicrophone()) {
            call.resolve(buildMicrophonePayload(false));
            return;
        }
        if (isMicrophoneGranted()) {
            call.resolve(buildMicrophonePayload(false));
            return;
        }
        requestPermissionForAlias(ALIAS_MICROPHONE, call, "microphonePermissionCallback");
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        call.resolve(buildMicrophonePayload(true));
    }

    @PluginMethod
    public void getPermissionDiagnostics(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        JSObject ret = new JSObject();
        ret.put("androidSdk", Build.VERSION.SDK_INT);
        ret.put("hasMicrophoneHardware", pm.hasSystemFeature(PackageManager.FEATURE_MICROPHONE));
        ret.put("hasCameraHardware", pm.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY));
        ret.put(
            "hasLocationHardware",
            pm.hasSystemFeature(PackageManager.FEATURE_LOCATION) ||
            pm.hasSystemFeature(PackageManager.FEATURE_LOCATION_NETWORK) ||
            pm.hasSystemFeature(PackageManager.FEATURE_LOCATION_GPS)
        );
        ret.put("notificationsEnabled", NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        call.resolve(ret);
    }
}
