"use strict";

// KISMET SETUP
var local_uri_prefix = "";
if (typeof (KISMET_URI_PREFIX) !== 'undefined')
    local_uri_prefix = KISMET_URI_PREFIX;

// CONNECTIONS
const hcx_interface = "wlan_0";

const user = "netnomad";
const pass = "123qwe";
const host = "192.168.1.112";
//const host = "localhost" // TODO: Allow this to be configurable by NetNomad users in settings

/// NetNomad Backend
/// Connect to the NetNomad Backend to send Device Data.
const uri_nn_hcx = `${host}:2501/netnomad/hcx`;

/// Kismet Backend
/// Connect to the Kismet Backent to receive Events.
var ws_eb = new WebSocket(`ws://${host}:2501/eventbus/events.ws?user=${user}&password=${pass}`);
ws_eb.onopen = function(event) {
    ws_eb.send(JSON.stringify({"SUBSCRIBE": "NETNOMAD"}));
 }
ws_eb.onmessage = function(msg_json) {
    var msg = JSON.parse(msg.data);
    
}

// HELPER FUNCTIONS
/// Parse the full JSON from a row into pertinent, simply named elements.
function parseDevData(dev_data) {
    // const dev_data = JSON.parse(row_json);
    const dev_type = dev_data['kismet.device.base.type'];
    const dev_name = dev_data['kismet.device.base.commonname'];
    const dev_ch = dev_data['kismet.device.base.channel'];
    const dev_bssid = dev_data['dot11.device.last_bssid'];

    return { dev_type, dev_name, dev_ch, dev_bssid };
}

/// Convert 1D JSON to a query string.
function jsonToQueryString(json) {
    return Object.keys(json)
      .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(json[key]))
      .join('&');
  }

// - JSON TO/FROM PROTOBUF (From Google)
function jsonToStructProto(json) {
    const fields = {};
    for (let k in json) {
      fields[k] = jsonValueToProto(json[k]);
    }
  
    return {fields};
  }

const JSON_SIMPLE_TYPE_TO_PROTO_KIND_MAP = {
  [typeof 0]: 'numberValue',
  [typeof '']: 'stringValue',
  [typeof false]: 'boolValue',
};

const JSON_SIMPLE_VALUE_KINDS = new Set([
  'numberValue',
  'stringValue',
  'boolValue',
]);

function jsonValueToProto(value) {
  const valueProto = {};

  if (value === null) {
    valueProto.kind = 'nullValue';
    valueProto.nullValue = 'NULL_VALUE';
  } else if (value instanceof Array) {
    valueProto.kind = 'listValue';
    valueProto.listValue = {values: value.map(jsonValueToProto)};
  } else if (typeof value === 'object') {
    valueProto.kind = 'structValue';
    valueProto.structValue = jsonToStructProto(value);
  } else if (typeof value in JSON_SIMPLE_TYPE_TO_PROTO_KIND_MAP) {
    const kind = JSON_SIMPLE_TYPE_TO_PROTO_KIND_MAP[typeof value];
    valueProto.kind = kind;
    valueProto[kind] = value;
  } else {
    console.warn('Unsupported value type ', typeof value);
  }
  return valueProto;
}

function structProtoToJson(proto) {
  if (!proto || !proto.fields) {
    return {};
  }
  const json = {};
  for (const k in proto.fields) {
    json[k] = valueProtoToJson(proto.fields[k]);
  }
  return json;
}

function valueProtoToJson(proto) {
  if (!proto || !proto.kind) {
    return null;
  }

  if (JSON_SIMPLE_VALUE_KINDS.has(proto.kind)) {
    return proto[proto.kind];
  } else if (proto.kind === 'nullValue') {
    return null;
  } else if (proto.kind === 'listValue') {
    if (!proto.listValue || !proto.listValue.values) {
      console.warn('Invalid JSON list value proto: ', JSON.stringify(proto));
    }
    return proto.listValue.values.map(valueProtoToJson);
  } else if (proto.kind === 'structValue') {
    return structProtoToJson(proto.structValue);
  } else {
    console.warn('Unsupported JSON value proto kind: ', proto.kind);
    return null;
  }
}

// BUTTON INTERACTION
/// Build the button with a custom callback from its row data.
function buildRowBtn(row) {
    return `
        <button 
            id='nn_hcx_btn_${row.dev_bssid}'
            class='NN_HCX_INTERACT_BUTTON' 
            onclick='netnomad.sendRowJSON(event, "${JSON.stringify(row).replace(/"/g, '\\"')}")'
        >
            HCX Interact
        </button>
        <div 
            id='nn_hcx_stat_${row.dev_bssid}'
            class='NN_HCX_INTERACT_STATUS'
            style="
                width: 20%;
                height: 75%;
                border-radius: 5%;
                background-color: #007700;
                padding: 10px;
                display: inline-block;
                text-align: center;
            "
        >
            STATUS
        </div>
    `;
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

    // Send to backend
    var tab_msg = "";
    try {
        const response = await fetch(`http://${uri_nn_hcx}`, {
            method: 'POST',
            headers: { "Content-Type": "application/x-protobuf" },
            body: jsonToStructProto(dev_data),
        });
        tab_msg = await response.text();
    }
    catch (error) { tab_msg = `There was an error during the Interaction:\n\n${error}`; }
    //try {
    //    const response = await fetch(`http://${uri_nn_hcx}?${jsonToQueryString(row_json)}`, {
    //        method: 'GET',
    //        headers: { "Content-Type": "application/json" },
    //    });
    //    tab_msg = await response.text();
    //}
    //catch (error) { tab_msg = `There was an error during the Interaction:\n\n${error}`; }

    const { dev_type, dev_name, dev_ch, dev_bssid } = dev_data;

    // Write to the Tab
    $('#NetNomadTab').html(`
        <div>
            DEVICE DATA: (WIP)
            <br><br>
            <b> - Type:</b> ${dev_type} <br>
            <b> - Name:</b> ${dev_name} <br>
            <b> - Ch:</b> ${dev_ch} <br>
            <b> - BSSID:</b> ${dev_bssid} <br>
            <br><br>
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

function renderButtons(data, type, row, meta) {
    return buildRowBtn(parseDevData(row));
}

function drawPackets(dyncolumn, table, row) {
    var row_id = table.column(dyncolumn.name + ':name').index();
    var match = "td:eq(" + row_id + ")";
    var data = row.data();

    $(match, row.node()).sparkline(simple_rrd, { 
        type: "bar",
        barColor: '#000000',
        nullColor: '#000000',
        zeroColor: '#000000'
    });
    $(match, row.node()).html(buildRowBtn(row));
    
};

// Device Interaction Column.
kismet_ui.AddDeviceColumn('column_netnomad_hcx', {
    sTitle: 'NetNomad HCX',
    field: 'kismet.device.base',
    renderfunc: function(data, type, row, meta) {
        return renderButtons(data, type, row, meta);
    },
    //drawfunc: function(data, type, row) {
    //    return drawPackets(data, type, row);
    //}
});

// Bottom Tab Pane. (WIP)
kismet_ui_tabpane.AddTab({
    id: 'NetNomadTab',
    tabTitle: 'NetNomad',
    createCallback: function(div) {
        div.html("<i>NetNomad data here.</i>");
    }
});

// Highlight NetNomad susceptible devices. (WIP)
kismet_ui.AddDeviceRowHighlight({
    name: "NetNomad Highlights",
    description: "Network can be interacted with from NetNomad.",
    priority: 10,
    defaultcolor: "#33F",
    defaultenable: true,
    fields: [
        'dot11.device/dot11.device.pmkid_packet'
    ],
    selector: function(data) {
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
            <select id="hcx_interface_dropdown" name="hcx_interface">
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
}

/// Save Settings to Global Vars
function saveSettings(event) {
    event.preventDefault();

    const data = new FormData(event.target);
    hcx_interface = data.get('hcx_interface');
    host = data.get('hcx_host_ip');
    
    // Write to the Tab
    $('#NetNomadTab').html(`
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
    create: function(e) { createSettings(e) },
    save: function(e) { saveSettings(e) }
});