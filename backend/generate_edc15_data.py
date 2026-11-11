import struct
import os

def generate_stock_edc15_bin(filepath: str):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    # 512 KB = 524,288 bytes (29F400BT)
    size = 512 * 1024
    bin_data = bytearray([0xFF] * size)
    
    # Write ECU info string in header/identification area (around 0x3F000)
    info_str = "038906019HJ  1.9l R4 EDC 0000SG  4871  BOSCH EDC15P+ VAG"
    for i, c in enumerate(info_str.encode('ascii')):
        bin_data[0x3F000 + i] = c
        
    # Standard Bosch 16-bit LoHi (Little Endian uint16) mapping
    
    # 1. Driver Wish Map (16x16) at 0x4C120
    # X Axis: 16 points (Pedal Position %: 0, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 100, 100, 100) -> factor 0.01 (0 to 10000)
    # Y Axis: 16 points (RPM: 0, 800, 1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000, 3500, 4000, 4500, 4800, 5000)
    dw_offset = 0x4C120
    # 16x16 map values (IQ in mg/stroke * 100, e.g. 0 to 5500 for 55.0 mg/str)
    for r in range(16):
        rpm_ratio = min(1.0, (r * 300 + 800) / 4500.0)
        for c in range(16):
            pedal_ratio = c / 15.0
            # Formula for driver wish curve
            iq = int(5500 * pedal_ratio * (1.1 - 0.2 * (rpm_ratio ** 2)))
            struct.pack_into('<H', bin_data, dw_offset + (r * 16 + c) * 2, max(0, min(65535, iq)))
            
    # 2. Turbo Boost Map (Ladedruck) at 0x4D200 (16x16)
    # X Axis: Injected Quantity (mg/stroke * 100): 1000 to 5500 (10 to 55 mg/str)
    # Y Axis: RPM: 1200 to 4500 RPM
    # Z Values: Absolute Boost Pressure in mbar * 10 (e.g., 10000 = 1000 mbar atmospheric, up to 21500 = 2150 mbar)
    boost_offset = 0x4D200
    for r in range(16):
        # RPM axis: 1200 to 4500
        rpm = 1200 + r * 220
        rpm_factor = 1.0 - 0.15 * max(0.0, (rpm - 3500) / 1000.0) if rpm > 3500 else min(1.0, rpm / 2000.0)
        for c in range(16):
            # IQ axis: 10 to 55 mg/str
            iq_factor = c / 15.0
            # Base boost: 1000 mbar (atmospheric) + up to 1150 mbar turbo boost
            boost_mbar = 1000 + int(1150 * iq_factor * rpm_factor)
            raw_val = boost_mbar * 10  # EDC15 uses factor 0.1 for mbar (e.g., 20500 raw = 2050 mbar)
            struct.pack_into('<H', bin_data, boost_offset + (r * 16 + c) * 2, max(0, min(65535, raw_val)))
            
    # 3. Smoke Limiter Map (Rauchbegrenzer) at 0x4E150 (16x16)
    # X Axis: Air Mass (MAF in mg/H): 300 to 1050
    # Y Axis: RPM: 1000 to 4500
    # Z Values: Maximum permitted fuel IQ (mg/str * 100) based on air availability (AFR control)
    smoke_offset = 0x4E150
    for r in range(16):
        for c in range(16):
            maf_ratio = c / 15.0
            max_iq = int(2000 + 3800 * maf_ratio)
            struct.pack_into('<H', bin_data, smoke_offset + (r * 16 + c) * 2, max(0, min(65535, max_iq)))
            
    # 4. Torque Limiter (Drehmomentbegrenzer) at 0x4F080 (16x1)
    torque_offset = 0x4F080
    torque_curve = [1500, 2200, 3100, 4200, 5100, 5200, 5150, 5000, 4800, 4500, 4200, 3800, 3400, 3000, 2500, 1800]
    for r in range(16):
        struct.pack_into('<H', bin_data, torque_offset + r * 2, torque_curve[r])
        
    # Write to file
    with open(filepath, 'wb') as f:
        f.write(bin_data)
        
    print(f"Generated {filepath} ({len(bin_data)} bytes).")

def generate_xdf_definition(filepath: str):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    xdf_content = """<!-- TunerPro XDF Definition File for Bosch EDC15 1.9 TDI -->
<XDFFORMAT version="1.60">
  <XDFHEADER>
    <flags>0x1</flags>
    <deletable>1</deletable>
    <description>Bosch EDC15P+ 1.9 TDI Standard Calibration Map Definition</description>
    <author>AutoTune AI Ground-Truth Database</author>
    <BASEOFFSET offset="0x0" />
    <DEFAULTS datasize="2" sigdigits="1" outputtype="1" signed="0" lsbfirst="1" />
  </XDFHEADER>

  <!-- MAP 1: Turbo Boost Target Map (16x16) -->
  <XDFTABLE uniqueid="0x4D200" flags="0x0">
    <title>Ladedruck Soll (Turbo Boost Target Map)</title>
    <description>Target absolute intake manifold turbo pressure in mbar</description>
    <CATEGORYMEM index="0" category="1" />
    <XDFAXIS id="x" uniqueid="0x0">
      <EMBEDDEDDATA mmedelementsizebits="16" mmedelements="16" mmedmajorstridebits="0" mmedminorstridebits="0" />
      <units>mg/H</units>
      <indexcount>16</indexcount>
      <datatype>0</datatype>
      <unittype>0</unittype>
      <DALINK index="0" />
      <LABEL index="0" value="10.0" />
      <LABEL index="15" value="55.0" />
      <MATH equation="X * 0.01">
        <VAR id="X" />
      </MATH>
    </XDFAXIS>
    <XDFAXIS id="y" uniqueid="0x0">
      <EMBEDDEDDATA mmedelementsizebits="16" mmedelements="16" mmedmajorstridebits="0" mmedminorstridebits="0" />
      <units>RPM</units>
      <indexcount>16</indexcount>
      <datatype>0</datatype>
      <unittype>0</unittype>
      <DALINK index="0" />
      <LABEL index="0" value="1200" />
      <LABEL index="15" value="4500" />
      <MATH equation="X * 1">
        <VAR id="X" />
      </MATH>
    </XDFAXIS>
    <XDFAXIS id="z">
      <EMBEDDEDDATA mmedtypeflags="0x02" mmedaddress="0x4D200" mmedelementsizebits="16" mmedelements="256" mmedrowelements="16" mmedcolumelements="16" mmedmajorstridebits="0" mmedminorstridebits="0" />
      <units>mbar</units>
      <decimalpl>0</decimalpl>
      <datatype>0</datatype>
      <unittype>0</unittype>
      <DALINK index="0" />
      <MATH equation="X * 0.1">
        <VAR id="X" />
      </MATH>
    </XDFAXIS>
  </XDFTABLE>

  <!-- MAP 2: Driver Wish Map (16x16) -->
  <XDFTABLE uniqueid="0x4C120" flags="0x0">
    <title>Fahrerwunsch (Driver Wish)</title>
    <description>Requested injection quantity based on throttle pedal position and RPM</description>
    <CATEGORYMEM index="0" category="2" />
    <XDFAXIS id="x" uniqueid="0x0">
      <units>% Pedal</units>
      <indexcount>16</indexcount>
      <MATH equation="X * 0.01">
        <VAR id="X" />
      </MATH>
    </XDFAXIS>
    <XDFAXIS id="y" uniqueid="0x0">
      <units>RPM</units>
      <indexcount>16</indexcount>
      <MATH equation="X * 1">
        <VAR id="X" />
      </MATH>
    </XDFAXIS>
    <XDFAXIS id="z">
      <EMBEDDEDDATA mmedtypeflags="0x02" mmedaddress="0x4C120" mmedelementsizebits="16" mmedelements="256" mmedrowelements="16" mmedcolumelements="16" />
      <units>mg/str</units>
      <decimalpl>2</decimalpl>
      <MATH equation="X * 0.01">
        <VAR id="X" />
      </MATH>
    </XDFAXIS>
  </XDFTABLE>

  <!-- MAP 3: Smoke Limiter Map (16x16) -->
  <XDFTABLE uniqueid="0x4E150" flags="0x0">
    <title>Rauchbegrenzer (Smoke Limiter)</title>
    <description>Maximum injected fuel volume limited by actual MAF air mass to avoid smoke</description>
    <CATEGORYMEM index="0" category="3" />
    <XDFAXIS id="z">
      <EMBEDDEDDATA mmedtypeflags="0x02" mmedaddress="0x4E150" mmedelementsizebits="16" mmedelements="256" mmedrowelements="16" mmedcolumelements="16" />
      <units>mg/str</units>
      <decimalpl>2</decimalpl>
      <MATH equation="X * 0.01">
        <VAR id="X" />
      </MATH>
    </XDFAXIS>
  </XDFTABLE>

  <!-- MAP 4: Torque Limiter (16x1) -->
  <XDFTABLE uniqueid="0x4F080" flags="0x0">
    <title>Drehmomentbegrenzer (Torque Limiter)</title>
    <description>Main engine torque limiter curve across RPM</description>
    <CATEGORYMEM index="0" category="4" />
    <XDFAXIS id="z">
      <EMBEDDEDDATA mmedtypeflags="0x02" mmedaddress="0x4F080" mmedelementsizebits="16" mmedelements="16" mmedrowelements="1" mmedcolumelements="16" />
      <units>mg/str</units>
      <decimalpl>2</decimalpl>
      <MATH equation="X * 0.01">
        <VAR id="X" />
      </MATH>
    </XDFAXIS>
  </XDFTABLE>
</XDFFORMAT>
"""
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(xdf_content)
    print(f"Generated {filepath} successfully.")

if __name__ == "__main__":
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    generate_stock_edc15_bin(os.path.join(project_root, "data", "edc15_19tdi_stock.bin"))
    generate_xdf_definition(os.path.join(project_root, "data", "edc15_19tdi.xdf"))

