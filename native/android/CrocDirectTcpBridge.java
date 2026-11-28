package app.crocflow.mobile;

import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Native Android TCP transport used only by the Capacitor APK. */
public final class CrocDirectTcpBridge {
    private static final int CONNECT_TIMEOUT_MS = 15_000;
    private static final Set<String> ALLOWED_HOSTS = new HashSet<>(Arrays.asList(
        "1.getcroc.com",
        "2.getcroc.com",
        "3.getcroc.com",
        "4.getcroc.com"
    ));

    private final WebView webView;
    private final Map<String, Connection> connections = new ConcurrentHashMap<>();

    public CrocDirectTcpBridge(WebView webView) {
        this.webView = webView;
    }

    @JavascriptInterface
    public void connect(String connectionId, String host, int port) {
        if (connectionId == null || connectionId.isEmpty()) return;
        if (host == null || !ALLOWED_HOSTS.contains(host.toLowerCase(Locale.ROOT)) || port < 9009 || port > 9017) {
            emit(connectionId, "error", null, "Relay host or port is not allowed");
            return;
        }

        close(connectionId);
        Connection connection = new Connection(connectionId);
        connections.put(connectionId, connection);
        new Thread(() -> open(connection, host, port), "croc-tcp-connect").start();
    }

    @JavascriptInterface
    public void send(String connectionId, String base64Data) {
        Connection connection = connections.get(connectionId);
        if (connection == null || connection.socket == null || base64Data == null) {
            emit(connectionId, "error", null, "Relay connection is not open");
            return;
        }
        connection.writer.execute(() -> {
            try {
                byte[] data = Base64.decode(base64Data, Base64.DEFAULT);
                synchronized (connection.writeLock) {
                    OutputStream output = connection.socket.getOutputStream();
                    output.write(data);
                    output.flush();
                }
            } catch (Exception error) {
                fail(connection, error.getMessage());
            }
        });
    }

    @JavascriptInterface
    public void close(String connectionId) {
        if (connectionId == null) return;
        Connection connection = connections.remove(connectionId);
        if (connection != null) {
            connection.closed = true;
            closeSocket(connection);
            connection.writer.shutdownNow();
        }
    }

    private void open(Connection connection, String host, int port) {
        try {
            Socket socket = new Socket();
            connection.socket = socket;
            socket.setKeepAlive(true);
            socket.connect(new InetSocketAddress(host, port), CONNECT_TIMEOUT_MS);
            if (connection.closed) {
                closeSocket(connection);
                return;
            }
            emit(connection.id, "open", null, null);

            InputStream input = socket.getInputStream();
            byte[] buffer = new byte[48 * 1024];
            int count;
            while (!connection.closed && (count = input.read(buffer)) != -1) {
                if (count == 0) continue;
                byte[] data = Arrays.copyOf(buffer, count);
                emit(connection.id, "data", Base64.encodeToString(data, Base64.NO_WRAP), null);
            }
            closeSocket(connection);
            connections.remove(connection.id, connection);
            connection.writer.shutdownNow();
            emit(connection.id, "close", null, null);
        } catch (Exception error) {
            connections.remove(connection.id, connection);
            closeSocket(connection);
            connection.writer.shutdownNow();
            if (!connection.closed) {
                emit(connection.id, "error", null, error.getMessage());
                emit(connection.id, "close", null, null);
            }
        }
    }

    private void fail(Connection connection, String message) {
        if (connection.closed) return;
        connection.closed = true;
        connections.remove(connection.id, connection);
        closeSocket(connection);
        connection.writer.shutdownNow();
        emit(connection.id, "error", null, message == null ? "Relay connection failed" : message);
        emit(connection.id, "close", null, null);
    }

    private void closeSocket(Connection connection) {
        try {
            if (connection.socket != null) connection.socket.close();
        } catch (Exception ignored) {
            // The socket is already closed.
        }
    }

    private void emit(String connectionId, String type, String data, String error) {
        try {
            JSONObject event = new JSONObject();
            event.put("connectionId", connectionId);
            event.put("type", type);
            if (data != null) event.put("data", data);
            if (error != null) event.put("error", error);
            String quoted = JSONObject.quote(event.toString());
            webView.post(() -> webView.evaluateJavascript(
                "window.__crocDirectTcpEvent && window.__crocDirectTcpEvent(" + quoted + ");",
                null
            ));
        } catch (JSONException ignored) {
            // All event fields are JSON-compatible strings.
        }
    }

    private static final class Connection {
        final String id;
        final Object writeLock = new Object();
        final ExecutorService writer = Executors.newSingleThreadExecutor();
        volatile Socket socket;
        volatile boolean closed;

        Connection(String id) {
            this.id = id;
        }
    }
}
