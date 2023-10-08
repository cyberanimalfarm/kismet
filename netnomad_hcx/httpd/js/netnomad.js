"use strict";

// KISMET SETUP
var local_uri_prefix = "";
if (typeof (KISMET_URI_PREFIX) !== 'undefined')
    local_uri_prefix = KISMET_URI_PREFIX;


// COLORS
const green = "#007700";
const yellow = "#DDD115";
const red = "#FA6741";
const blue = "#54A0F8";

// DEVICE STATES
var dev_states = {};
const state_map = {
    READY: green,
    REQUESTING: yellow,
    WORKING: yellow,
    ERROR: red,
};

// CONNECTIONS
const hcx_interface = "wlan_0";

// Assuming we're not too concerned about these being hardcoded?
const user = "netnomad";
const pass = "123qwe";
// TODO: Allow this to be configurable by NetNomad users in settings
const host = "192.168.1.112";
const port = 2501;

/// NetNomad Backend
/// Connect to the NetNomad Backend to send Device Data.
const uri_nn_hcx = `${host}:${port}/netnomad/hcx`;

/// Kismet Backend
/// Connect to the Kismet Backent to receive NetNomad Events.
var ws_nn_eb = new WebSocket(`ws://${host}:${port}/eventbus/events.ws?user=${user}&password=${pass}`);
ws_nn_eb.onopen = function (event) {
    ws_nn_eb.send(JSON.stringify({ "SUBSCRIBE": "NETNOMAD" }));
    console.log("Subscribed to NetNomad Events.");
}
ws_nn_eb.onmessage = function (msg_json) {
    const msg_raw = JSON.parse(msg_json.data)['kismet.eventbus.event_json'];
    const msg = JSON.parse(msg_raw.replace(/\\"/g, ''));
    console.log(`NetNomad Backend: ${JSON.stringify(msg)}`);

    // Update Device Status
    dev_states[msg['bssid']] = {
        status: msg['status'],
        color: state_map[msg['status']]
    };
}

/// Pull Usable Interfaces.
async function pullDataSources() {
    var data_sources = {};
    try {
        const response = await fetch(`http://${host}:${port}/datasource/all_sources.json`, {
            method: 'GET',
            headers: {
                "Content-Type": "application/json",
            },
        });
        if (!response.ok) {
            console.error("There was an HTTP error while pulling the interface data.");
            return data_sources;
        }
        const if_data = await response.json();
        //console.debug(`Interface Data: ${JSON.stringify(if_data)}`);
        if_data.forEach(function(element) {
            console.debug(`Checking IF: ${element['kismet.datasource.uuid']}`)
            if (
                !element['kismet.datasource.type_driver']['kismet.datasource.driver.type'].includes("wifi") //||
                //element['kismet.datasource.running'] == 1
            ) return;
            console.debug(`Adding IF: ${element['kismet.datasource.uuid']}`)
            data_sources[element['kismet.datasource.uuid']] = {
                name: element['kismet.datasource.name'],
                channels: element['kismet.datasource.channels']
            };
        });
        console.debug(`Interface Data: ${JSON.stringify(data_sources)}`);
    }
    catch (error) { console.error(`There was an error pulling the interface data: ${error}`) }
    return data_sources;
}

// HELPER FUNCTIONS
/// Parse the full JSON from a row into pertinent, simply named elements.
function parseDevData(dev_data) {
    const dev_bssid = dev_data['dot11.device.last_bssid'];
    const dev_type = dev_data['kismet.device.base.type'];
    const dev_name = dev_data['kismet.device.base.commonname'];
    const dev_ch = dev_data['kismet.device.base.channel'];

    return { dev_type, dev_name, dev_ch, dev_bssid };
}

/// Convert 1D JSON to a query string.
function jsonToQueryString(json) {
    return Object.keys(json)
        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(json[key]))
        .join('&');
}

/// Timestamp
function timeStamp() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
  
    return `${hours}:${minutes}:${seconds}`;
}


// ROW INTERACTION
/// Wrapper for `buildDevRow()` to be called by Kismet API for renderfunc
function renderRows(data, type, row, meta) {
    return buildDevRow(parseDevData(row));
    //return updDevRow(parseDevData(row));
}
/// Wrapper for `buildDevRow()` to be called by Kismet API for drawfunc
function drawRows(dyncolumn, table, row) {
    return buildDevRow(parseDevData(row));
}
/// Build the row with: 
/// - A button with a custom callback from its row data.
/// - A status indicator for interactions.
function buildDevRow(row) {
    const { dev_type, dev_name, dev_ch, dev_bssid } = row;
    var dev_row = $('<div>') 
    dev_row.append(`
        <button 
            id='nn_hcx_btn_${dev_bssid}'
            class='NN_HCX_INTERACT_BUTTON' 
            onclick='netnomad.sendRowJSON(event, "${JSON.stringify(row).replace(/"/g, '\\"')}")'
        >
            HCX Interact
        </button>
        <div 
            id='nn_hcx_stat_${dev_bssid}'
            class='NN_HCX_INTERACT_STATUS'
            style="
                width: 20%;
                height: 75%;
                border-radius: 5%;
                background-color: ${green};
                padding: 10px;
                display: inline-block;
                text-align: center;
            "
        >
            READY
        </div>
    `);

    if (dev_bssid in dev_states) {
        console.debug(`Device w/ Status: ${dev_bssid}`);
        const dev_state = dev_states[dev_bssid];
        dev_row.find(`.NN_HCX_INTERACT_STATUS`)
            .css("background-color", `${dev_state['color']}`)
            .text(`${dev_state['status']}`);
    } 

    return dev_row.html();
}

/// Send row data (as JSON) to the NetNomad backend and write it to the Tab.
export async function sendRowJSON(event, row_json) {
    // Prevent the row window from popping up.
    event.stopPropagation();

    // Disable Button while working
    const btn_text = event.target.textContent;
    event.target.textContent = "Interacting...";
    event.target.disabled = true;

    // Get the Device Data
    const dev_data = JSON.parse(row_json);
    const { dev_type, dev_name, dev_ch, dev_bssid } = dev_data;

    // Update Device Status
    dev_states[dev_bssid] = {
        status: "REQUESTING",
        color: state_map['REQUESTING']
    };

    // Send to backend
    var tab_msg = "";
    try {
        const response = await fetch(`http://${uri_nn_hcx}`, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                "Content-Length": row_json.length.toString()
            },
            body: row_json,
        });
        tab_msg = await response.text();
    }
    catch (error) { tab_msg = `There was an error during the Interaction:\n\n${error}`; }


    // Write to the Tab
    writeToTab(`
        <div>
            DEVICE DATA:<br>
            <b> - Type:</b> ${dev_type} <br>
            <b> - Name:</b> ${dev_name} <br>
            <b> - Ch:</b> ${dev_ch} <br>
            <b> - BSSID:</b> ${dev_bssid} <br>
            ${tab_msg}
        </div>
    `);

    // Push the user to the Tab (this is hardcoded to the 3rd tab)
    $('#ui-id-3').click();

    // Re-enable button
    event.target.disabled = false;
    event.target.textContent = btn_text;

    console.log(`NetNomad Interaction!`);
}

// Device Interaction Column.
kismet_ui.AddDeviceColumn('column_netnomad_hcx', {
    sTitle: 'NetNomad HCX',
    field: 'kismet.device.base',
    renderfunc: function (data, type, row, meta) {
        return renderRows(data, type, row, meta);
    },
    drawfunc: function(dyncolumn, table, row) {
        return drawRows(dyncolumn, table, row);
    }
});

// Bottom Tab Pane.
kismet_ui_tabpane.AddTab({
    id: 'NetNomadTab',
    tabTitle: 'NetNomad',
    createCallback: function (div) {
        div.html("<i>NetNomad data here.</i><br>");
    }
});
/// Write to the Tab and scroll down.
function writeToTab(data) {
    $('#NetNomadTab').append(`
        <b>${timeStamp()}:</b><br>
        ${data}<br><br>
    `);
    $('#NetNomadTab').scrollTop($('#NetNomadTab')[0].scrollHeight);
}

// Highlight NetNomad susceptible devices. (WIP)
kismet_ui.AddDeviceRowHighlight({
    name: "NetNomad Highlights",
    description: "Network can be interacted with from NetNomad.",
    priority: 10,
    defaultcolor: blue,
    defaultenable: true,
    fields: [
        'dot11.device/dot11.device.pmkid_packet'
    ],
    selector: function (data) {
        try {
            return 'dot11.device.pmkid_packet' in data && data['dot11.device.pmkid_packet'] != 0;
        } catch (e) {
            return false;
        }
    }
});

// SETTINGS
/// Create Settings Form
function createSettings(elem) {
    elem.html(`
        <form id="netnomad_settings_form>
            <label for="dropdown">HCX Interface:</label>
            <br>
            <select id="hcx_datasource_dropdown" name="hcx_datasource">
                <option value="option1">Option 1</option>
                <option value="option2">Option 2</option>
                <option value="option3">Option 3</option>
            </select>
            <br><br>
      
            <label for="textbox">Host IP:</label>
            <br>
            <input type="text" id="hcx_host_ip_textbox" name="hcx_host_ip" placeholder="${host}">
            <br><br>

            <input type="submit" value="Apply">
        </form>
    `);
    $('#netnomad_settings_form').submit(saveSettings);
    $('#hcx_datasource_dropdown').hover(function(event) {
        const data_sources = pullDataSources();
        console.debug(JSON.stringify(data_sources));
        const dropdown = $('#hcx_datasource_dropdown');
        dropdown.html('');
        data_sources.forEach(function(key, element) {
            dropdown.append(`<option value='${element['name']}'>${element['name']}</option>`);
        });
    });
}

/// Save Settings to Global Vars
function saveSettings(event) {
    event.preventDefault();

    const data = new FormData(event.target);
    hcx_interface = data.get('hcx_interface');
    host = data.get('hcx_host_ip');

    // Write to the Tab
    writeToTab(`
        <div>
            SETTINGS UPDATED: (WIP)
            <br><br>
            <b> - HCX Interface:</b> ${hcx_interface} <br>
            <b> - HCX Host:</b> ${host} <br>
        </div>
    `);
}

// Settings
kismet_ui_settings.AddSettingsPane({
    id: 'netnomad_settings',
    listTitle: 'NetNomad Settings',
    create: function (e) { createSettings(e) },
    //save: function (e) { saveSettings(e) }
});