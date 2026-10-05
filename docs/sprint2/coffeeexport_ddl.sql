-- CoffeeExport Manager – RITECH SAS
-- Script DDL para MySQL 8.0+ (modelo propuesto en el Sprint 2)
CREATE DATABASE IF NOT EXISTS coffeeexport CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE coffeeexport;

-- Catálogo de roles de acceso.
CREATE TABLE roles (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE,
  descripcion VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Catálogo de permisos atómicos del sistema.
CREATE TABLE permisos (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(80) NOT NULL UNIQUE,
  descripcion VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla intermedia N:M entre roles y permisos.
CREATE TABLE roles_permisos (
  rol_id BIGINT NOT NULL,
  permiso_id BIGINT NOT NULL,
  PRIMARY KEY (rol_id, permiso_id),
  CONSTRAINT fk_roles_permisos_rol_id FOREIGN KEY (rol_id) REFERENCES roles(id),
  CONSTRAINT fk_roles_permisos_permiso_id FOREIGN KEY (permiso_id) REFERENCES permisos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Usuarios internos del sistema.
CREATE TABLE usuarios (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  rol_id BIGINT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_acceso DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_usuarios_rol_id FOREIGN KEY (rol_id) REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Clientes internacionales de la Unión Europea.
CREATE TABLE clientes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  pais CHAR(2) NOT NULL,
  identificacion_fiscal VARCHAR(30) NOT NULL UNIQUE,
  contacto_nombre VARCHAR(100) NOT NULL,
  contacto_email VARCHAR(150) NOT NULL,
  contacto_telefono VARCHAR(30) NULL,
  direccion VARCHAR(255) NULL,
  consentimiento_datos BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_consentimiento DATETIME NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Catálogo de café y cacao.
CREATE TABLE productos (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(30) NOT NULL UNIQUE,
  nombre VARCHAR(120) NOT NULL,
  tipo ENUM('CAFE','CACAO') NOT NULL,
  variedad VARCHAR(80) NULL,
  precio_usd_kg DECIMAL(12,2) NOT NULL CHECK (precio_usd_kg > 0),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bodegas donde se almacena el inventario.
CREATE TABLE bodegas (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  ciudad VARCHAR(100) NULL,
  activa BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Existencias de un producto en una bodega.
CREATE TABLE inventario (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  producto_id BIGINT NOT NULL,
  bodega_id BIGINT NOT NULL,
  cantidad_kg DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (cantidad_kg >= 0),
  stock_minimo_kg DECIMAL(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_inventario_producto_bodega (producto_id, bodega_id),
  CONSTRAINT fk_inventario_producto_id FOREIGN KEY (producto_id) REFERENCES productos(id),
  CONSTRAINT fk_inventario_bodega_id FOREIGN KEY (bodega_id) REFERENCES bodegas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Pedidos y envíos de exportación.
CREATE TABLE exportaciones (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL UNIQUE,
  cliente_id BIGINT NOT NULL,
  pais_destino CHAR(2) NOT NULL,
  puerto_salida VARCHAR(100) NOT NULL,
  puerto_llegada VARCHAR(100) NOT NULL,
  fecha_envio DATE NOT NULL,
  estado ENUM('BORRADOR','EN_PREPARACION','EN_TRANSITO','ENTREGADA','CANCELADA') NOT NULL DEFAULT 'BORRADOR',
  usuario_creador_id BIGINT NOT NULL,
  observaciones VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_exportaciones_cliente_id FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  CONSTRAINT fk_exportaciones_usuario_creador_id FOREIGN KEY (usuario_creador_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Productos incluidos en cada exportación (líneas de detalle).
CREATE TABLE detalle_exportacion (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  exportacion_id BIGINT NOT NULL,
  producto_id BIGINT NOT NULL,
  cantidad_kg DECIMAL(12,2) NOT NULL CHECK (cantidad_kg > 0),
  precio_unitario DECIMAL(12,2) NOT NULL CHECK (precio_unitario > 0),
  subtotal DECIMAL(14,2) GENERATED ALWAYS AS (cantidad_kg * precio_unitario) STORED,
  CONSTRAINT fk_detalle_exportacion_exportacion_id FOREIGN KEY (exportacion_id) REFERENCES exportaciones(id),
  CONSTRAINT fk_detalle_exportacion_producto_id FOREIGN KEY (producto_id) REFERENCES productos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Trazabilidad de entradas, salidas y ajustes de stock.
CREATE TABLE movimientos_inventario (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  inventario_id BIGINT NOT NULL,
  tipo ENUM('ENTRADA','SALIDA','AJUSTE') NOT NULL,
  cantidad_kg DECIMAL(12,2) NOT NULL CHECK (cantidad_kg > 0),
  motivo VARCHAR(255) NULL,
  exportacion_id BIGINT NULL,
  usuario_id BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_movimientos_inventario_inventario_id FOREIGN KEY (inventario_id) REFERENCES inventario(id),
  CONSTRAINT fk_movimientos_inventario_exportacion_id FOREIGN KEY (exportacion_id) REFERENCES exportaciones(id),
  CONSTRAINT fk_movimientos_inventario_usuario_id FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Documentos de exportación (certificados y aduanas).
CREATE TABLE documentos (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  exportacion_id BIGINT NOT NULL,
  tipo ENUM('CERTIFICADO_ORIGEN','FITOSANITARIO','FACTURA_COMERCIAL','LISTA_EMPAQUE','DECLARACION_ADUANERA','OTRO') NOT NULL,
  nombre_archivo VARCHAR(200) NOT NULL,
  ruta_archivo VARCHAR(255) NOT NULL,
  estado_validacion ENUM('PENDIENTE','VALIDADO','RECHAZADO') NOT NULL DEFAULT 'PENDIENTE',
  subido_por BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_documentos_exportacion_id FOREIGN KEY (exportacion_id) REFERENCES exportaciones(id),
  CONSTRAINT fk_documentos_subido_por FOREIGN KEY (subido_por) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Pagos internacionales asociados a exportaciones.
CREATE TABLE pagos (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  exportacion_id BIGINT NOT NULL,
  monto DECIMAL(14,2) NOT NULL CHECK (monto > 0),
  moneda CHAR(3) NOT NULL CHECK (moneda IN ('USD','EUR')),
  metodo ENUM('TRANSFERENCIA','CARTA_CREDITO','OTRO') NOT NULL,
  referencia VARCHAR(80) NULL,
  fecha_pago DATE NOT NULL,
  estado ENUM('PENDIENTE','CONFIRMADO','RECHAZADO') NOT NULL DEFAULT 'PENDIENTE',
  registrado_por BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pagos_exportacion_id FOREIGN KEY (exportacion_id) REFERENCES exportaciones(id),
  CONSTRAINT fk_pagos_registrado_por FOREIGN KEY (registrado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Datos iniciales: roles
INSERT INTO roles (nombre, descripcion) VALUES
  ('ADMIN', 'Administrador del sistema'),
  ('GERENTE', 'Gerente / Ejecutivo'),
  ('OP_EXPORTACIONES', 'Operador de exportaciones'),
  ('OP_BODEGA', 'Operador de bodega'),
  ('CONTADOR', 'Contador / Finanzas');
