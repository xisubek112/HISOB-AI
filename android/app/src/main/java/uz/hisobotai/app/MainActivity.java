package uz.hisobotai.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(HisobotPermissionsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
