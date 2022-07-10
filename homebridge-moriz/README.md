# PI Wifi Setup

Edit `wpa_supplicant.conf` in `/boot` partition

```properties
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
country=DE

network={
     ssid="SSID"
     psk="PS"
     scan_ssid=1
}
```
