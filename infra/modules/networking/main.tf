resource "oci_core_vcn" "main" {
  compartment_id = var.compartment_id
  display_name   = "${var.project_name}-${var.environment}-vcn"
  cidr_blocks    = ["10.0.0.0/16"]
  dns_label      = "${var.project_name}${var.environment}"

  freeform_tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "oci_core_internet_gateway" "main" {
  compartment_id = var.compartment_id
  vcn_id         = oci_core_vcn.main.id
  display_name   = "${var.project_name}-${var.environment}-igw"
  enabled        = true
}

resource "oci_core_route_table" "public" {
  compartment_id = var.compartment_id
  vcn_id         = oci_core_vcn.main.id
  display_name   = "${var.project_name}-${var.environment}-public-rt"

  route_rules {
    network_entity_id = oci_core_internet_gateway.main.id
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
  }
}

resource "oci_core_security_list" "app" {
  compartment_id = var.compartment_id
  vcn_id         = oci_core_vcn.main.id
  display_name   = "${var.project_name}-${var.environment}-app-sl"

  egress_security_rules {
    destination = "0.0.0.0/0"
    protocol    = "all"
  }

  # HTTPS
  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"
    tcp_options { max = 443; min = 443 }
  }

  # MQTT over TLS
  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"
    tcp_options { max = 8883; min = 8883 }
  }

  # LiveKit RTC TCP
  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"
    tcp_options { max = 7881; min = 7880 }
  }

  # LiveKit RTC UDP
  ingress_security_rules {
    protocol = "17"
    source   = "0.0.0.0/0"
    udp_options { max = 7882; min = 7882 }
  }

  # Coturn TURN TCP
  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"
    tcp_options { max = 5349; min = 3478 }
  }

  # Coturn TURN UDP
  ingress_security_rules {
    protocol = "17"
    source   = "0.0.0.0/0"
    udp_options { max = 5349; min = 3478 }
  }

  # SSH (restrict to your IP in production)
  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"
    tcp_options { max = 22; min = 22 }
  }
}

resource "oci_core_subnet" "app" {
  compartment_id    = var.compartment_id
  vcn_id            = oci_core_vcn.main.id
  display_name      = "${var.project_name}-${var.environment}-app-subnet"
  cidr_block        = "10.0.1.0/24"
  route_table_id    = oci_core_route_table.public.id
  security_list_ids = [oci_core_security_list.app.id]
  dns_label         = "app"
}

output "app_subnet_id" {
  value = oci_core_subnet.app.id
}

output "vcn_id" {
  value = oci_core_vcn.main.id
}
