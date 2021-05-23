/*
gnome-extensions create --interactive
cd ~/.local/share/gnome-shell/extensions
ls

go to `extensions` software to enable your extension

alt+f2 + r to reload if no syntax error
sudo journalctl /usr/bin/gnome-shell | grep 'screendarker'
logout to reload if has syntax error

doc: https://gjs-docs.gnome.org/appindicator301~0.1_api/appindicator3.indicator
gnome built-in icons: https://archlinux.org/packages/extra/any/gnome-icon-theme-symbolic/files/


https://github.com/yingshaoxo/gnome-shell-screen-darker
https://github.com/GNOME/gjs
https://gjs-docs.gnome.org/glib20~2.66.1/
https://gjs-docs.gnome.org/glib20~2.66.1/glib.spawn_command_line_sync
https://gjs.guide/guides/gtk/3/15-saving-data.html#converting-data
https://extensions.gnome.org/extension/1276/night-light-slider/
https://codeberg.org/kiyui/gnome-shell-night-light-slider-extension/src/branch/main/src/extension.js
*/

const GETTEXT_DOMAIN = 'my-indicator-extension';

const { GObject, St, Clutter } = imports.gi;

const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;

const ByteArray = imports.byteArray;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

function run_command(command) {
    // https://gjs.guide/guides/gio/subprocesses.html#synchronous-execution
    // https://gjs-docs.gnome.org/glib20~2.66.1/glib.spawn_command_line_sync
    try {
        let [, stdout, stderr, status] = GLib.spawn_command_line_sync(command);

        if (status !== 0) {
            if (stderr instanceof Uint8Array) {
                stderr = ByteArray.toString(stderr);
            }
            //throw new Error(stderr);
            return stderr;
        }

        if (stdout instanceof Uint8Array) {
            stdout = ByteArray.toString(stdout);
        }

        return stdout;
    } catch (e) {
        return e.toString();
    }
}


let dataDir = GLib.get_user_config_dir();
let destination = GLib.build_filenamev([dataDir, 'screendarker', 'settings.json']);
let destinationFile = Gio.File.new_for_path(destination);
const PERMISSIONS_MODE = 0o744;

function save_json(data) {
    let dataJSON = JSON.stringify(data);

    if (GLib.mkdir_with_parents(destinationFile.get_parent().get_path(), PERMISSIONS_MODE) === 0) {
        let [success, tag] = destinationFile.replace_contents(dataJSON, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);

        if (success) {
            /* it worked! */
            //Main.notify("saved");
        } else {
            /* it failed */
        }
    } else {
        /* error */
    }
}

function read_json() {
    try {
        let [success, contents] = destinationFile.load_contents(null);
        if (contents == null) {
            return undefined;
        } else {
            const result = JSON.parse(contents)
            //Main.notify("readed");
            return result
        }
    } catch (e) {
        return undefined;
    }
}


let brightness = "0.5";


const Indicator = GObject.registerClass(
    class Indicator extends PanelMenu.Button {
        _init() {
            super._init(0.0, _('My Shiny Indicator'));


            const monitor_id = run_command(`/bin/bash -c 'xrandr | grep " connected" | cut -f1 -d " "'`).trim()
            //Main.notify(monitor_id)


            let box = new St.BoxLayout({ style_class: 'panel-status-menu-box' });

            //let iconPath = `${Me.path}/icons/timeclock-16x16.svg`; // just for debug if path is correct
            //let gicon = Gio.icon_new_for_string(`${iconPath}`);
            //let icon = new St.Icon({ gicon: gicon, style_class: 'system-status-icon', icon_size: 16 });


            box.add_child(new St.Icon({
                icon_name: 'display-brightness-symbolic',
                style_class: 'system-status-icon',
            }));
            //box.add_child(PopupMenu.arrowIcon(St.Side.BOTTOM));
            //this.add_child(box); //this will disable 'button_press_event' 

            this.add_actor(box);

            let item = new PopupMenu.PopupMenuItem(_('Thank you for using'));
            item.connect('activate', () => {
                run_command(`/bin/bash -c "xdg-open 'https://github.com/yingshaoxo'"`);
            });
            this.menu.addMenuItem(item);

            let item2 = new PopupMenu.PopupBaseMenuItem({ activate: false });
            this.menu.addMenuItem(item2);

            // Create the slider
            let slider = new Slider.Slider(0);
            slider.connect('notify::value', () => {
                let value = slider.value.toFixed(2)
                if (value < 0.2) {
                    value = 0.2
                }
                //Main.notify(value);
                run_command(`xrandr --output '${monitor_id}' --brightness ${value}`)
                brightness = value;
            })
            slider.accessible_name = _('Brightness');
            slider.value = parseFloat(brightness)
            item2.add(slider);

            this.connect('button_press_event', (_obj, evt) => {
                // only override primary button behavior
                if (evt.get_button() == Clutter.BUTTON_PRIMARY) {
                    this.menu.close();
                    //Main.notify(_('left click?'));
                    if (read_json().switch == "on") {
                        run_command(`xrandr --output '${monitor_id}' --brightness ${brightness}`)
                        save_json({ "switch": "off", "brightness": brightness });
                        //Main.notify(_('off'));
                    } else {
                        run_command(`xrandr --output '${monitor_id}' --brightness 1.0`)
                        save_json({ "switch": "on", "brightness": brightness });
                        //Main.notify(_('on'));
                    }
                    return;
                } else {
                    //Main.notify(_('right click?'));
                    return;
                }
            });
        }
    }
);

class Extension {
    constructor(uuid) {
        this._uuid = uuid;

        ExtensionUtils.initTranslations(GETTEXT_DOMAIN);
    }

    enable() {
        if (read_json() == undefined) {
            save_json({ "switch": "on", "brightness": "0.5" });
        } else {
            let settings = read_json()
            brightness = settings.brightness
        }

        this._indicator = new Indicator();
        Main.panel.addToStatusArea(this._uuid, this._indicator, 0, "left");
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}

function init(meta) {
    return new Extension(meta.uuid);
}
