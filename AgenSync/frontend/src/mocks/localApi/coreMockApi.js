import { getSuggestedServices } from "../../data/businessOnboarding.js";

const TOKEN_KEY = "agensync_token";
const DB_KEY = "agensync_local_db_v1";
const PASSWORD_RESET_KEY = "agensync_local_password_resets_v1";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

const pad = (value) => String(value).padStart(2, "0");

function id(prefix) {
  if (window.crypto?.randomUUID) return `${prefix}_${window.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function today() {
  return formatDate(new Date());
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function minutesFromTime(time) {
  const [hours, minutes] = String(time).split(":").map(Number);
  return hours * 60 + minutes;
}

function timeFromMinutes(total) {
  const minutes = ((total % 1440) + 1440) % 1440;
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function addMinutesToTime(time, minutes) {
  return timeFromMinutes(minutesFromTime(time) + Number(minutes));
}

function dateTime(date, time) {
  return new Date(`${date}T${time}:00`);
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    businessName: user.businessName,
    businessLogo: user.businessLogo || "",
    businessType: user.businessType,
    createdAt: user.createdAt
  };
}

function publicClient(client) {
  return {
    id: client.id,
    name: client.name,
    phone: client.phone,
    notes: client.notes || "",
    createdAt: client.createdAt,
    updatedAt: client.updatedAt
  };
}

function publicService(service) {
  return {
    id: service.id,
    name: service.name,
    priceDefault: Number(service.priceDefault),
    durationMinutes: Number(service.durationMinutes),
    isActive: Boolean(service.isActive),
    createdAt: service.createdAt,
    updatedAt: service.updatedAt
  };
}

function publicProfessional(professional) {
  return {
    id: professional.id,
    name: professional.name,
    role: professional.role || "",
    phone: professional.phone || "",
    isActive: Boolean(professional.isActive),
    createdAt: professional.createdAt,
    updatedAt: professional.updatedAt
  };
}

function seedDb() {
  const now = new Date();
  const todayDate = formatDate(now);
  const yesterday = formatDate(addDays(now, -1));
  const threeDaysAgo = formatDate(addDays(now, -3));
  const eightDaysAgo = formatDate(addDays(now, -8));
  const tomorrow = formatDate(addDays(now, 1));
  const nextWeek = formatDate(addDays(now, 6));
  const createdAt = new Date().toISOString();
  const userId = "user_demo";

  const clients = [
    { id: "client_maria", userId, name: "Maria Oliveira", phone: "(11) 98888-1001", notes: "Prefere atendimento no período da manhã.", createdAt, updatedAt: createdAt },
    { id: "client_joao", userId, name: "João Pereira", phone: "(11) 97777-2040", notes: "Cliente recorrente quinzenal.", createdAt, updatedAt: createdAt },
    { id: "client_camila", userId, name: "Camila Santos", phone: "(11) 96666-3388", notes: "Tem alergia a cola com látex.", createdAt, updatedAt: createdAt },
    { id: "client_ana", userId, name: "Ana Costa", phone: "(11) 95555-7722", notes: "", createdAt, updatedAt: createdAt },
    { id: "client_luiza", userId, name: "Luiza Martins", phone: "(11) 94444-9012", notes: "Gosta de confirmar pelo WhatsApp.", createdAt, updatedAt: createdAt }
  ];

  const services = [
    { id: "service_manicure", userId, name: "Manicure completa", priceDefault: 55, durationMinutes: 60, isActive: true, createdAt, updatedAt: createdAt },
    { id: "service_barba", userId, name: "Barba alinhada", priceDefault: 45, durationMinutes: 40, isActive: true, createdAt, updatedAt: createdAt },
    { id: "service_sobrancelha", userId, name: "Design de sobrancelha", priceDefault: 70, durationMinutes: 50, isActive: true, createdAt, updatedAt: createdAt },
    { id: "service_lash", userId, name: "Manutenção de cílios", priceDefault: 120, durationMinutes: 90, isActive: true, createdAt, updatedAt: createdAt },
    { id: "service_antigo", userId, name: "Pacote antigo", priceDefault: 90, durationMinutes: 75, isActive: false, createdAt, updatedAt: createdAt }
  ];

  const professionals = [
    { id: "professional_main", userId, name: "Profissional Teste", role: "Profissional principal", phone: "(11) 90000-0000", isActive: true, createdAt, updatedAt: createdAt },
    { id: "professional_marina", userId, name: "Marina Alves", role: "Fisioterapeuta", phone: "(11) 91111-2000", isActive: true, createdAt, updatedAt: createdAt }
  ];

  const serviceById = Object.fromEntries(services.map((service) => [service.id, service]));
  const makeAppointment = (appointment) => {
    const service = serviceById[appointment.serviceId];
    return {
      id: appointment.id,
      userId,
      clientId: appointment.clientId,
      serviceId: appointment.serviceId,
      professionalId: appointment.professionalId || professionals[0].id,
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: addMinutesToTime(appointment.startTime, service.durationMinutes),
      price: appointment.price ?? service.priceDefault,
      notes: appointment.notes || "",
      status: appointment.status || "agendado",
      createdAt,
      updatedAt: createdAt
    };
  };

  return {
    users: [
      {
        id: userId,
        name: "Profissional Teste",
        email: "teste@agensync.com",
        password: "123456",
        businessName: "Studio AgenSync",
        businessLogo: "",
        businessType: "Beleza e estética",
        createdAt,
        updatedAt: createdAt
      }
    ],
    clients,
    professionals,
    services,
    appointments: [
      makeAppointment({ id: "appt_today_1", clientId: "client_maria", serviceId: "service_manicure", date: todayDate, startTime: "09:00", status: "concluido", notes: "Pagamento recebido em dinheiro." }),
      makeAppointment({ id: "appt_today_2", clientId: "client_joao", serviceId: "service_barba", date: todayDate, startTime: "10:30", status: "agendado" }),
      makeAppointment({ id: "appt_today_3", clientId: "client_camila", serviceId: "service_sobrancelha", professionalId: "professional_marina", date: todayDate, startTime: "14:00", status: "agendado", price: 75 }),
      makeAppointment({ id: "appt_today_4", clientId: "client_ana", serviceId: "service_lash", professionalId: "professional_marina", date: todayDate, startTime: "16:00", status: "cancelado", notes: "Cancelou por conflito de horário." }),
      makeAppointment({ id: "appt_yesterday_1", clientId: "client_luiza", serviceId: "service_lash", professionalId: "professional_marina", date: yesterday, startTime: "13:00", status: "concluido" }),
      makeAppointment({ id: "appt_three_days_1", clientId: "client_camila", serviceId: "service_sobrancelha", professionalId: "professional_marina", date: threeDaysAgo, startTime: "11:00", status: "nao_compareceu" }),
      makeAppointment({ id: "appt_eight_days_1", clientId: "client_maria", serviceId: "service_manicure", date: eightDaysAgo, startTime: "15:00", status: "concluido", price: 60 }),
      makeAppointment({ id: "appt_tomorrow_1", clientId: "client_luiza", serviceId: "service_lash", date: tomorrow, startTime: "09:30", status: "agendado" }),
      makeAppointment({ id: "appt_next_week_1", clientId: "client_joao", serviceId: "service_barba", date: nextWeek, startTime: "17:00", status: "agendado" })
    ]
  };
}

function readDb() {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) {
    const seeded = seedDb();
    localStorage.setItem(DB_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const db = JSON.parse(raw);
    if (!Array.isArray(db.users)) throw new Error("invalid");
    return ensureDbShape(db);
  } catch {
    const seeded = seedDb();
    localStorage.setItem(DB_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function writeDb(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function readResetRequests() {
  const raw = localStorage.getItem(PASSWORD_RESET_KEY);
  if (!raw) return [];

  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeResetRequests(requests) {
  localStorage.setItem(PASSWORD_RESET_KEY, JSON.stringify(requests));
}

function createResetToken() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function ensureDbShape(db) {
  let changed = false;
  const now = new Date().toISOString();

  if (!Array.isArray(db.professionals)) {
    db.professionals = [];
    changed = true;
  }

  db.users.forEach((user) => {
    const userProfessionals = db.professionals.filter((professional) => professional.userId === user.id);

    if (!userProfessionals.length) {
      db.professionals.push({
        id: id("professional"),
        userId: user.id,
        name: user.name || "Profissional principal",
        role: "Profissional principal",
        phone: "",
        isActive: true,
        createdAt: now,
        updatedAt: now
      });
      changed = true;
    }
  });

  db.appointments = (db.appointments || []).map((appointment) => {
    if (appointment.professionalId) return appointment;

    const professional = db.professionals.find((item) => item.userId === appointment.userId);
    changed = true;
    return {
      ...appointment,
      professionalId: professional?.id || ""
    };
  });

  if (changed) writeDb(db);
  return db;
}

function currentUserId() {
  const token = getToken();
  if (!token?.startsWith("local:")) {
    throw new Error("Sessão expirada ou não autenticada.");
  }
  return token.split(":")[1];
}

function getCurrentUser(db) {
  const user = db.users.find((item) => item.id === currentUserId());
  if (!user) throw new Error("Usuário não encontrado.");
  return user;
}

function enrichAppointment(db, appointment) {
  const client = db.clients.find((item) => item.id === appointment.clientId);
  const service = db.services.find((item) => item.id === appointment.serviceId);
  const professional = db.professionals.find((item) => item.id === appointment.professionalId);

  return {
    ...appointment,
    price: Number(appointment.price),
    client: client ? publicClient(client) : undefined,
    service: service ? publicService(service) : undefined,
    professional: professional ? publicProfessional(professional) : undefined
  };
}

function findClientOrFail(db, userId, clientId) {
  const client = db.clients.find((item) => item.id === clientId && item.userId === userId);
  if (!client) throw new Error("Cliente inválido para este usuário.");
  return client;
}

function findServiceOrFail(db, userId, serviceId) {
  const service = db.services.find((item) => item.id === serviceId && item.userId === userId);
  if (!service) throw new Error("Serviço inválido para este usuário.");
  return service;
}

function findProfessionalOrFail(db, userId, professionalId) {
  if (!professionalId) throw new Error("profissional é obrigatório.");
  const professional = db.professionals.find((item) => item.id === professionalId && item.userId === userId);
  if (!professional) throw new Error("Profissional inválido para este usuário.");
  return professional;
}

function validateRequired(value, field) {
  if (!String(value || "").trim()) throw new Error(`${field} é obrigatório.`);
}

function normalizeBusinessLogo(value) {
  const logo = String(value || "").trim();
  if (!logo) return "";
  if (!/^data:image\/(png|jpeg|webp);base64,/.test(logo)) {
    throw new Error("Logo inválida.");
  }
  if (logo.length > 900000) {
    throw new Error("Logo muito grande.");
  }
  return logo;
}

function normalizeAppointmentPayload(payload, current = null) {
  const data = { ...payload };
  if (!data.status) data.status = current?.status || "agendado";
  if (!["agendado", "concluido", "cancelado", "nao_compareceu"].includes(data.status)) {
    throw new Error("status inválido.");
  }
  return data;
}

function assertNoConflict(db, userId, appointment, ignoreId = null) {
  if (appointment.status === "cancelado") return;

  const start = dateTime(appointment.date, appointment.startTime);
  const end = dateTime(appointment.date, appointment.endTime);
  const conflict = db.appointments.find((item) => {
    if (item.userId !== userId || item.id === ignoreId || item.status === "cancelado") return false;
    if (appointment.professionalId && item.professionalId !== appointment.professionalId) return false;
    const itemStart = dateTime(item.date, item.startTime);
    const itemEnd = dateTime(item.date, item.endTime);
    return itemStart < end && itemEnd > start;
  });

  if (conflict) {
    const client = db.clients.find((item) => item.id === conflict.clientId);
    throw new Error(`Conflito de horário com ${client?.name || "outro cliente"} às ${conflict.startTime}.`);
  }
}

function filterAppointments(db, userId, params = {}) {
  return db.appointments
    .filter((appointment) => appointment.userId === userId)
    .filter((appointment) => !params.date || appointment.date === params.date)
    .filter((appointment) => !params.startDate || appointment.date >= params.startDate)
    .filter((appointment) => !params.endDate || appointment.date <= params.endDate)
    .filter((appointment) => !params.clientId || appointment.clientId === params.clientId)
    .filter((appointment) => !params.professionalId || appointment.professionalId === params.professionalId)
    .filter((appointment) => !params.status || appointment.status === params.status)
    .sort((first, second) => `${first.date}T${first.startTime}`.localeCompare(`${second.date}T${second.startTime}`))
    .map((appointment) => enrichAppointment(db, appointment));
}

function sumCompleted(appointments) {
  return appointments
    .filter((appointment) => appointment.status === "concluido")
    .reduce((total, appointment) => total + Number(appointment.price || 0), 0);
}

function startOfWeekString(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return formatDate(date);
}

function normalizeInitialServices(payload) {
  const hasCustomServices = Array.isArray(payload.initialServices);
  const source = hasCustomServices ? payload.initialServices : getSuggestedServices(payload.businessType);

  return source
    .map((service) => {
      const name = String(service.name || "").trim();
      if (name.length < 2) return null;

      const priceDefault = Number(service.priceDefault ?? 0);
      const durationMinutes = Number(service.durationMinutes ?? 60);

      return {
        name,
        priceDefault: Number.isFinite(priceDefault) && priceDefault >= 0 ? Number(priceDefault.toFixed(2)) : 0,
        durationMinutes: Number.isInteger(durationMinutes) && durationMinutes > 0 ? durationMinutes : 60,
        isActive: service.isActive !== false
      };
    })
    .filter(Boolean);
}

const localApi = {
  async register(payload) {
    const db = readDb();
    validateRequired(payload.name, "nome");
    validateRequired(payload.email, "email");
    validateRequired(payload.password, "senha");
    validateRequired(payload.businessName, "nome do negócio");
    validateRequired(payload.businessType, "tipo de negócio");

    const email = String(payload.email).trim().toLowerCase();
    if (db.users.some((user) => user.email === email)) {
      throw new Error("Já existe uma conta com esse email.");
    }

    const now = new Date().toISOString();
    const user = {
      id: id("user"),
      name: payload.name.trim(),
      email,
      password: payload.password,
      businessName: payload.businessName.trim(),
      businessLogo: normalizeBusinessLogo(payload.businessLogo),
      businessType: payload.businessType.trim(),
      createdAt: now,
      updatedAt: now
    };

    db.users.push(user);
    db.services.push(
      ...normalizeInitialServices(payload).map((service) => ({
        id: id("service"),
        userId: user.id,
        ...service,
        createdAt: now,
        updatedAt: now
      }))
    );
    db.professionals.push({
      id: id("professional"),
      userId: user.id,
      name: user.name,
      role: "Profissional principal",
      phone: "",
      isActive: true,
      createdAt: now,
      updatedAt: now
    });
    writeDb(db);

    return { token: `local:${user.id}`, user: publicUser(user) };
  },

  async login(payload) {
    const db = readDb();
    const email = String(payload.email || "").trim().toLowerCase();
    const user = db.users.find((item) => item.email === email && item.password === payload.password);

    if (!user) {
      throw new Error("Email ou senha inválidos.");
    }

    return { token: `local:${user.id}`, user: publicUser(user) };
  },

  async forgotPassword(payload) {
    const email = String(payload?.email || "").trim().toLowerCase();
    validateRequired(email, "email");

    const db = readDb();
    const user = db.users.find((item) => item.email === email);
    if (!user) {
      return {
        message: "Se o email existir, enviaremos um link de redefinição.",
        resetUrl: ""
      };
    }

    const token = createResetToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();
    const requests = readResetRequests().filter((request) => request.userId !== user.id);
    requests.push({
      token,
      userId: user.id,
      email,
      expiresAt,
      createdAt: new Date().toISOString()
    });
    writeResetRequests(requests);

    return {
      message: "Link de redefinição gerado no modo local para testes.",
      resetUrl: `${window.location.origin}/reset-password?token=${token}`
    };
  },

  async resetPassword(payload) {
    const token = String(payload?.token || "").trim();
    const password = String(payload?.password || "");
    validateRequired(token, "token de redefinição");
    validateRequired(password, "senha");
    if (password.length < 6) {
      throw new Error("A nova senha precisa ter pelo menos 6 caracteres.");
    }

    const requests = readResetRequests();
    const request = requests.find((item) => item.token === token);
    if (!request) {
      throw new Error("Link de redefinição inválido ou expirado.");
    }
    if (new Date(request.expiresAt).getTime() < Date.now()) {
      throw new Error("Link de redefinição expirado.");
    }

    const db = readDb();
    const user = db.users.find((item) => item.id === request.userId);
    if (!user) {
      throw new Error("Conta não encontrada para redefinição.");
    }

    user.password = password;
    user.updatedAt = new Date().toISOString();
    writeDb(db);
    writeResetRequests(requests.filter((item) => item.token !== token));

    return { message: "Senha atualizada com sucesso." };
  },

  async me() {
    const db = readDb();
    return { user: publicUser(getCurrentUser(db)) };
  },

  async updateUserSettings(payload) {
    const db = readDb();
    const user = getCurrentUser(db);
    validateRequired(payload.businessType, "tipo de negócio");
    if (payload.businessName !== undefined) {
      validateRequired(payload.businessName, "nome do negócio");
      user.businessName = payload.businessName.trim();
    }
    if (payload.businessLogo !== undefined) {
      user.businessLogo = normalizeBusinessLogo(payload.businessLogo);
    }

    user.businessType = payload.businessType.trim();
    user.updatedAt = new Date().toISOString();
    writeDb(db);

    return { user: publicUser(user) };
  },

  async listClients() {
    const db = readDb();
    const userId = currentUserId();
    const clients = db.clients
      .filter((client) => client.userId === userId)
      .sort((first, second) => first.name.localeCompare(second.name))
      .map(publicClient);
    return { clients };
  },

  async createClient(payload) {
    const db = readDb();
    const userId = currentUserId();
    validateRequired(payload.name, "nome");
    validateRequired(payload.phone, "telefone");
    const now = new Date().toISOString();
    const client = {
      id: id("client"),
      userId,
      name: payload.name.trim(),
      phone: payload.phone.trim(),
      notes: String(payload.notes || "").trim(),
      createdAt: now,
      updatedAt: now
    };
    db.clients.push(client);
    writeDb(db);
    return { client: publicClient(client) };
  },

  async updateClient(clientId, payload) {
    const db = readDb();
    const userId = currentUserId();
    const client = findClientOrFail(db, userId, clientId);
    validateRequired(payload.name, "nome");
    validateRequired(payload.phone, "telefone");
    client.name = payload.name.trim();
    client.phone = payload.phone.trim();
    client.notes = String(payload.notes || "").trim();
    client.updatedAt = new Date().toISOString();
    writeDb(db);
    return { client: publicClient(client) };
  },

  async deleteClient(clientId) {
    const db = readDb();
    const userId = currentUserId();
    findClientOrFail(db, userId, clientId);
    if (db.appointments.some((appointment) => appointment.userId === userId && appointment.clientId === clientId)) {
      throw new Error("Não é possível excluir cliente com agendamentos vinculados.");
    }
    db.clients = db.clients.filter((client) => client.id !== clientId);
    writeDb(db);
    return null;
  },

  async listProfessionals(params = {}) {
    const db = readDb();
    const userId = currentUserId();
    const professionals = db.professionals
      .filter((professional) => professional.userId === userId)
      .filter((professional) => params.active !== "true" && params.active !== true ? true : professional.isActive)
      .sort((first, second) => Number(second.isActive) - Number(first.isActive) || first.name.localeCompare(second.name))
      .map(publicProfessional);
    return { professionals };
  },

  async createProfessional(payload) {
    const db = readDb();
    const userId = currentUserId();
    validateRequired(payload.name, "nome");
    const now = new Date().toISOString();
    const professional = {
      id: id("professional"),
      userId,
      name: payload.name.trim(),
      role: String(payload.role || "").trim(),
      phone: String(payload.phone || "").trim(),
      isActive: payload.isActive !== false,
      createdAt: now,
      updatedAt: now
    };
    db.professionals.push(professional);
    writeDb(db);
    return { professional: publicProfessional(professional) };
  },

  async updateProfessional(professionalId, payload) {
    const db = readDb();
    const userId = currentUserId();
    const professional = findProfessionalOrFail(db, userId, professionalId);
    validateRequired(payload.name, "nome");
    professional.name = payload.name.trim();
    professional.role = String(payload.role || "").trim();
    professional.phone = String(payload.phone || "").trim();
    professional.isActive = payload.isActive !== false;
    professional.updatedAt = new Date().toISOString();
    writeDb(db);
    return { professional: publicProfessional(professional) };
  },

  async deleteProfessional(professionalId) {
    const db = readDb();
    const userId = currentUserId();
    findProfessionalOrFail(db, userId, professionalId);
    if (db.appointments.some((appointment) => appointment.userId === userId && appointment.professionalId === professionalId)) {
      throw new Error("Não é possível excluir profissional com agendamentos. Desative-o para ocultar na criação.");
    }
    db.professionals = db.professionals.filter((professional) => professional.id !== professionalId);
    writeDb(db);
    return null;
  },

  async listServices(params = {}) {
    const db = readDb();
    const userId = currentUserId();
    const services = db.services
      .filter((service) => service.userId === userId)
      .filter((service) => params.active !== "true" && params.active !== true ? true : service.isActive)
      .sort((first, second) => Number(second.isActive) - Number(first.isActive) || first.name.localeCompare(second.name))
      .map(publicService);
    return { services };
  },

  async createService(payload) {
    const db = readDb();
    const userId = currentUserId();
    validateRequired(payload.name, "nome");
    const priceDefault = Number(payload.priceDefault);
    const durationMinutes = Number(payload.durationMinutes);
    if (!Number.isFinite(priceDefault) || priceDefault < 0) throw new Error("preço padrão deve ser maior ou igual a zero.");
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) throw new Error("duração deve ser maior que zero.");
    const now = new Date().toISOString();
    const service = {
      id: id("service"),
      userId,
      name: payload.name.trim(),
      priceDefault,
      durationMinutes,
      isActive: payload.isActive !== false,
      createdAt: now,
      updatedAt: now
    };
    db.services.push(service);
    writeDb(db);
    return { service: publicService(service) };
  },

  async updateService(serviceId, payload) {
    const db = readDb();
    const userId = currentUserId();
    const service = findServiceOrFail(db, userId, serviceId);
    validateRequired(payload.name, "nome");
    const priceDefault = Number(payload.priceDefault);
    const durationMinutes = Number(payload.durationMinutes);
    if (!Number.isFinite(priceDefault) || priceDefault < 0) throw new Error("preço padrão deve ser maior ou igual a zero.");
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) throw new Error("duração deve ser maior que zero.");
    service.name = payload.name.trim();
    service.priceDefault = priceDefault;
    service.durationMinutes = durationMinutes;
    service.isActive = payload.isActive !== false;
    service.updatedAt = new Date().toISOString();
    writeDb(db);
    return { service: publicService(service) };
  },

  async deleteService(serviceId) {
    const db = readDb();
    const userId = currentUserId();
    findServiceOrFail(db, userId, serviceId);
    if (db.appointments.some((appointment) => appointment.userId === userId && appointment.serviceId === serviceId)) {
      throw new Error("Não é possível excluir serviço com agendamentos. Desative-o para ocultar na criação.");
    }
    db.services = db.services.filter((service) => service.id !== serviceId);
    writeDb(db);
    return null;
  },

  async listAppointments(params = {}) {
    const db = readDb();
    return { appointments: filterAppointments(db, currentUserId(), params) };
  },

  async createAppointment(payload) {
    const db = readDb();
    const userId = currentUserId();
    const data = normalizeAppointmentPayload(payload);
    validateRequired(data.clientId, "cliente");
    validateRequired(data.professionalId, "profissional");
    validateRequired(data.serviceId, "serviço");
    validateRequired(data.date, "data");
    validateRequired(data.startTime, "hora inicial");
    findClientOrFail(db, userId, data.clientId);
    const professional = findProfessionalOrFail(db, userId, data.professionalId);
    const service = findServiceOrFail(db, userId, data.serviceId);
    if (!professional.isActive) throw new Error("Profissionais inativos não podem ser usados em novos agendamentos.");
    if (!service.isActive) throw new Error("Serviços inativos não podem ser usados em novos agendamentos.");

    const now = new Date().toISOString();
    const appointment = {
      id: id("appt"),
      userId,
      clientId: data.clientId,
      serviceId: data.serviceId,
      professionalId: data.professionalId,
      date: data.date,
      startTime: data.startTime,
      endTime: addMinutesToTime(data.startTime, service.durationMinutes),
      price: data.price === undefined || data.price === "" ? service.priceDefault : Number(data.price),
      notes: String(data.notes || "").trim(),
      status: data.status,
      createdAt: now,
      updatedAt: now
    };

    if (!Number.isFinite(appointment.price) || appointment.price < 0) throw new Error("valor deve ser maior ou igual a zero.");
    assertNoConflict(db, userId, appointment);
    db.appointments.push(appointment);
    writeDb(db);
    return { appointment: enrichAppointment(db, appointment) };
  },

  async updateAppointment(appointmentId, payload) {
    const db = readDb();
    const userId = currentUserId();
    const appointment = db.appointments.find((item) => item.id === appointmentId && item.userId === userId);
    if (!appointment) throw new Error("Agendamento não encontrado.");

    const data = normalizeAppointmentPayload(payload, appointment);
    const clientId = data.clientId ?? appointment.clientId;
    const serviceId = data.serviceId ?? appointment.serviceId;
    const professionalId = data.professionalId ?? appointment.professionalId;
    const date = data.date ?? appointment.date;
    const startTime = data.startTime ?? appointment.startTime;
    findClientOrFail(db, userId, clientId);
    const professional = findProfessionalOrFail(db, userId, professionalId);
    const service = findServiceOrFail(db, userId, serviceId);
    if (serviceId !== appointment.serviceId && !service.isActive) {
      throw new Error("Serviços inativos não podem ser usados em novos agendamentos.");
    }

    if (professionalId !== appointment.professionalId && !professional.isActive) {
      throw new Error("Profissionais inativos não podem ser usados em novos agendamentos.");
    }

    const timeChanged = data.date !== undefined || data.startTime !== undefined || data.serviceId !== undefined;
    const next = {
      ...appointment,
      clientId,
      serviceId,
      professionalId,
      date,
      startTime,
      endTime: timeChanged ? addMinutesToTime(startTime, service.durationMinutes) : appointment.endTime,
      price:
        data.price === undefined || data.price === ""
          ? serviceId !== appointment.serviceId
            ? service.priceDefault
            : appointment.price
          : Number(data.price),
      notes: data.notes === undefined ? appointment.notes : String(data.notes || "").trim(),
      status: data.status,
      updatedAt: new Date().toISOString()
    };

    if (!Number.isFinite(next.price) || next.price < 0) throw new Error("valor deve ser maior ou igual a zero.");
    assertNoConflict(db, userId, next, appointmentId);
    Object.assign(appointment, next);
    writeDb(db);
    return { appointment: enrichAppointment(db, appointment) };
  },

  async deleteAppointment(appointmentId) {
    const db = readDb();
    const userId = currentUserId();
    const exists = db.appointments.some((appointment) => appointment.id === appointmentId && appointment.userId === userId);
    if (!exists) throw new Error("Agendamento não encontrado.");
    db.appointments = db.appointments.filter((appointment) => appointment.id !== appointmentId);
    writeDb(db);
    return null;
  },

  async dashboard(params = {}) {
    const db = readDb();
    const userId = currentUserId();
    const selectedDate = params.date || today();
    const appointmentsToday = filterAppointments(db, userId, { date: selectedDate });
    const monthPrefix = selectedDate.slice(0, 7);
    const monthAppointments = filterAppointments(db, userId).filter((appointment) => appointment.date.startsWith(monthPrefix));
    const now = new Date();
    const nextAppointment =
      filterAppointments(db, userId, { status: "agendado" }).find(
        (appointment) => dateTime(appointment.date, appointment.startTime) >= now
      ) || null;

    return {
      date: selectedDate,
      appointmentsToday: appointmentsToday.length,
      earnedToday: sumCompleted(appointmentsToday),
      earnedMonth: sumCompleted(monthAppointments),
      nextAppointment,
      todayAppointments: appointmentsToday
    };
  },

  async finance(params = {}) {
    const db = readDb();
    const userId = currentUserId();
    const selectedDate = params.date || today();
    const weekStart = startOfWeekString(selectedDate);
    const monthPrefix = selectedDate.slice(0, 7);
    const all = filterAppointments(db, userId);
    const todayAppointments = all.filter((appointment) => appointment.date === selectedDate);
    const weekAppointments = all.filter((appointment) => appointment.date >= weekStart && appointment.date <= selectedDate);
    const monthAppointments = all.filter((appointment) => appointment.date.startsWith(monthPrefix));

    return {
      totalReceivedToday: sumCompleted(todayAppointments),
      totalReceivedWeek: sumCompleted(weekAppointments),
      totalReceivedMonth: sumCompleted(monthAppointments),
      completedAppointmentsMonth: monthAppointments.filter((appointment) => appointment.status === "concluido").length
    };
  }
};

export const localCoreMockApi = localApi;


