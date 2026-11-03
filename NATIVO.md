# App nativo (opcional): Não Perturbe automático

O Helenodoro web não consegue silenciar o celular. Para o Android fazer isso sozinho, empacote o mesmo código com o [Capacitor](https://capacitorjs.com/) e um pluginzinho.

## 1. Criar o projeto nativo

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init Helenodoro com.helenodoro.app --web-dir app
npx cap add android
```

## 2. Plugin `HelenodoroDnd` (Android)

`android/app/src/main/java/com/helenodoro/app/HelenodoroDndPlugin.java`:

```java
package com.helenodoro.app;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "HelenodoroDnd")
public class HelenodoroDndPlugin extends Plugin {
  private int previous = NotificationManager.INTERRUPTION_FILTER_ALL;

  private NotificationManager nm() {
    return (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
  }

  @PluginMethod
  public void enable(PluginCall call) {
    NotificationManager nm = nm();
    if (!nm.isNotificationPolicyAccessGranted()) {
      // Abre a tela do sistema para o usuário autorizar uma vez.
      getActivity().startActivity(new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS));
      call.reject("permissao");
      return;
    }
    previous = nm.getCurrentInterruptionFilter();
    nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY);
    call.resolve();
  }

  @PluginMethod
  public void disable(PluginCall call) {
    NotificationManager nm = nm();
    if (nm.isNotificationPolicyAccessGranted()) nm.setInterruptionFilter(previous);
    call.resolve();
  }
}
```

No `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.ACCESS_NOTIFICATION_POLICY" />
```

Registre o plugin em `MainActivity.java` com `registerPlugin(HelenodoroDndPlugin.class);`.

Pronto: `platform/focus.js` detecta `window.Capacitor.Plugins.HelenodoroDnd` e passa a ligar o Não Perturbe no início de cada bloco e desligar no intervalo. Nenhuma outra linha do app muda.

## iPhone

A Apple não permite que apps liguem o Foco. O caminho no iPhone continua sendo o usuário ligar o Foco "Estudo" (Central de Controle ou automação por horário em Atalhos).
