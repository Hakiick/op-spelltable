#!/usr/bin/env python3
"""
Non-interactive screenshot on GNOME Wayland via XDG Desktop Portal.

Usage: python3 scripts/screenshot-portal.py [output.png]
"""

import sys
import os
import shutil
from urllib.parse import urlparse, unquote
import gi

gi.require_version("Gio", "2.0")
gi.require_version("GLib", "2.0")
from gi.repository import Gio, GLib


def take_screenshot(output_path: str) -> bool:
    bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
    loop = GLib.MainLoop()
    result_holder = {"uri": None, "success": False}

    def on_response(
        connection, sender_name, object_path, interface_name, signal_name, parameters
    ):
        response, results = parameters.unpack()
        if response == 0 and "uri" in results:
            result_holder["uri"] = results["uri"]
            result_holder["success"] = True
        loop.quit()

    # Call Screenshot via portal
    proxy = Gio.DBusProxy.new_sync(
        bus,
        Gio.DBusProxyFlags.NONE,
        None,
        "org.freedesktop.portal.Desktop",
        "/org/freedesktop/portal/desktop",
        "org.freedesktop.portal.Screenshot",
        None,
    )

    result = proxy.call_sync(
        "Screenshot",
        GLib.Variant("(sa{sv})", ("", {"interactive": GLib.Variant("b", False)})),
        Gio.DBusCallFlags.NONE,
        5000,
        None,
    )

    request_path = result.unpack()[0]

    # Subscribe to the Response signal on this request
    bus.signal_subscribe(
        "org.freedesktop.portal.Desktop",
        "org.freedesktop.portal.Request",
        "Response",
        request_path,
        None,
        Gio.DBusSignalFlags.NO_MATCH_RULE,
        on_response,
    )

    # Timeout after 5 seconds
    GLib.timeout_add_seconds(5, lambda: (loop.quit(), False)[1])
    loop.run()

    if result_holder["success"] and result_holder["uri"]:
        # Portal returns file:///path/to/screenshot.png
        parsed = urlparse(result_holder["uri"])
        src_path = unquote(parsed.path)
        shutil.copy2(src_path, output_path)
        print(output_path)
        return True
    else:
        print("ERROR: Screenshot failed or timed out", file=sys.stderr)
        return False


if __name__ == "__main__":
    output = sys.argv[1] if len(sys.argv) > 1 else "/tmp/portal-screenshot.png"
    success = take_screenshot(output)
    sys.exit(0 if success else 1)
