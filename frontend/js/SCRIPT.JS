/* =====================================================
   SISTEM PERSEDIAAN TOKO BUTIK
   JavaScript + Supabase
===================================================== */


/* =====================================================
   VARIABEL GLOBAL
===================================================== */

let dataBahanBaku = [];
let dataBarangJadi = [];
let dataResep = [];
let dataTransaksi = [];

let editBahanBakuId = null;
let editBarangJadiId = null;
let currentAccountingReport = null;
let lastLowStockNotificationSignature = null;
let catalogCodeSuggestionRequest = 0;


/* =====================================================
   SAAT HALAMAN DIBUKA
===================================================== */

let activeUserId = null;
let applicationInitialized = false;

document.addEventListener("DOMContentLoaded", async function () {
    const loginForm = document.getElementById("loginForm");
    const logoutButton = document.getElementById("logoutButton");
    const togglePassword = document.getElementById("togglePassword");

    loginForm.addEventListener("submit", signIn);
    logoutButton.addEventListener("click", signOut);
    togglePassword.addEventListener("click", function () {
        const passwordInput = document.getElementById("loginPassword");
        const isVisible = passwordInput.type === "text";
        passwordInput.type = isVisible ? "password" : "text";
        togglePassword.setAttribute("aria-pressed", String(!isVisible));
        togglePassword.setAttribute(
            "aria-label",
            isVisible ? "Tampilkan kata sandi" : "Sembunyikan kata sandi"
        );
    });

    if (!supabaseClient) {
        setAuthMessage("Koneksi Supabase belum tersedia. Periksa konfigurasi dan koneksi internet.");
        document.getElementById("loginButton").disabled = true;
        return;
    }

    supabaseClient.auth.onAuthStateChange(function (_event, session) {
        setTimeout(function () {
            applyAuthSession(session).catch(function (error) {
                console.error("Gagal menyiapkan sesi:", error);
                showNotification("Gagal menyiapkan sesi akun. Muat ulang halaman dan coba lagi.", "error");
            });
        }, 0);
    });

    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();

        if (error) {
            console.error("Gagal memeriksa sesi:", error);
            setAuthMessage("Sesi tidak dapat diperiksa. Muat ulang halaman dan coba lagi.");
            return;
        }

        await applyAuthSession(session);
    } catch (error) {
        console.error("Gagal memeriksa sesi:", error);
        setAuthMessage("Tidak dapat terhubung ke layanan login. Periksa koneksi internet lalu coba lagi.");
    }
});

async function signIn(event) {
    event.preventDefault();

    const loginButton = document.getElementById("loginButton");
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    loginButton.disabled = true;
    setAuthMessage("");

    try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

        if (error) {
            console.error("Gagal masuk:", error);
            if (error.code === "email_not_confirmed") {
                setAuthMessage("Akun belum dikonfirmasi. Konfirmasi akun di Supabase Authentication → Users.");
            } else if (error.code === "invalid_credentials") {
                setAuthMessage("Supabase menolak email atau kata sandi. Pastikan kata sandi yang dimasukkan adalah kata sandi akun Supabase.");
            } else {
                setAuthMessage("Login gagal: " + error.message);
            }
            return;
        }

        document.getElementById("loginPassword").value = "";
    } catch (error) {
        console.error("Gagal menghubungi layanan login:", error);
        setAuthMessage("Tidak dapat terhubung ke layanan login. Periksa koneksi internet lalu coba lagi.");
    } finally {
        loginButton.disabled = false;
    }
}

async function signOut() {
    const logoutButton = document.getElementById("logoutButton");
    logoutButton.disabled = true;

    try {
        const { error } = await supabaseClient.auth.signOut();

        if (error) {
            console.error("Gagal keluar:", error);
            showNotification("Gagal keluar dari akun. Silakan coba lagi.", "error");
        }
    } catch (error) {
        console.error("Gagal menghubungi layanan autentikasi:", error);
        showNotification("Tidak dapat keluar karena layanan autentikasi tidak terjangkau.", "error");
    } finally {
        logoutButton.disabled = false;
    }
}

async function applyAuthSession(session) {
    const authScreen = document.getElementById("authScreen");
    const appShell = document.getElementById("appShell");

    if (!session) {
        activeUserId = null;
        applicationInitialized = false;
        appShell.hidden = true;
        authScreen.hidden = false;
        return;
    }

    authScreen.hidden = true;
    appShell.hidden = false;
    document.getElementById("currentUserEmail").textContent = session.user.email || "";

    if (activeUserId === session.user.id && applicationInitialized) {
        return;
    }

    activeUserId = session.user.id;
    applicationInitialized = true;
    await initializeApplication();
}

function setAuthMessage(message) {
    document.getElementById("authMessage").textContent = message;
}

async function initializeApplication() {

    console.log("Sistem Persediaan Toko Butik dimulai...");

    // Tanggal transaksi otomatis hari ini
    const tanggal = document.getElementById("tanggalTransaksi");

    if (tanggal) {

        const today = new Date();

        const year = today.getFullYear();

        const month = String(
            today.getMonth() + 1
        ).padStart(2, "0");

        const day = String(
            today.getDate()
        ).padStart(2, "0");

        tanggal.value = `${year}-${month}-${day}`;
    }


    // Buat pilihan barang transaksi
    createTransactionItemSelect();


    const jenisTransaksiInput = document.getElementById("jenisTransaksi");

    if (jenisTransaksiInput) {
        jenisTransaksiInput.addEventListener("change", function () {
            document.getElementById("hargaPerolehanTransaksi").value = "";
            document.getElementById("hargaJualTransaksi").value = "";
            document.getElementById("metodePembayaranTransaksi").value = "";
            document.getElementById("jumlahTransaksi").value = "";
            syncTransactionForm();
        });
        syncTransactionForm();
    }

    ["hargaPerolehanTransaksi", "hargaJualTransaksi", "jumlahTransaksi"].forEach(function (id) {
        document.getElementById(id).addEventListener("input", function () {
            syncTransactionFields();
            updateTransactionPreview();
        });
    });

    document.getElementById("itemTransaksi").addEventListener("change", function () {
        syncTransactionQuantity();
        syncTransactionItemDetails();
        updateTransactionPreview();
    });

    document.getElementById("metodePembayaranTransaksi").addEventListener("change", updateTransactionPreview);

    const reportForm = document.getElementById("laporanForm");
    reportForm.addEventListener("submit", function (event) {
        event.preventDefault();
        loadAccountingReport();
    });

    const today = getTodayDateString();
    const monthStart = `${today.slice(0, 7)}-01`;
    document.getElementById("laporanDari").value = monthStart;
    document.getElementById("laporanSampai").value = today;


    // Event form bahan baku
    const bahanForm =
        document.getElementById(
            "bahanBakuForm"
        );

    if (bahanForm) {

        bahanForm.addEventListener(
            "submit",
            saveBahanBaku
        );

        ["jenisBahan", "namaBahan"].forEach(function (id) {
            document.getElementById(id).addEventListener("change", function () {
                if (editBahanBakuId) {
                    return;
                }

                const prefix = getMaterialCodePrefix(
                    document.getElementById("jenisBahan").value,
                    document.getElementById("namaBahan").value
                );
                suggestCatalogCode(prefix, "kodeBahan", "bahan_baku", "kode_bahan");
            });
        });
    }


    // Event form barang jadi
    const barangForm =
        document.getElementById(
            "barangJadiForm"
        );

    if (barangForm) {

        barangForm.addEventListener(
            "submit",
            saveBarangJadi
        );

        ["kategoriBarang", "namaBarang"].forEach(function (id) {
            document.getElementById(id).addEventListener("change", function () {
                if (editBarangJadiId) {
                    return;
                }

                const prefix = getProductCodePrefix(
                    document.getElementById("kategoriBarang").value,
                    document.getElementById("namaBarang").value
                );
                suggestCatalogCode(prefix, "kodeBarang", "barang_jadi", "kode_barang");
            });
        });
    }

    // Event form transaksi
    const transaksiForm =
        document.getElementById(
            "transaksiForm"
        );

    if (transaksiForm) {

        transaksiForm.addEventListener(
            "submit",
            saveTransaksi
        );
    }

    const resepForm = document.getElementById("resepForm");

    if (resepForm) {
        resepForm.addEventListener("submit", saveResep);
    }

    [transaksiForm, resepForm].forEach(function (form) {
        if (!form) return;
        ["input", "change"].forEach(function (eventName) {
            form.addEventListener(eventName, function () {
                form.dataset.dirty = "true";
            });
        });
    });


    // Load seluruh data
    await loadAllData();

}


/* =====================================================
   LOAD SEMUA DATA
===================================================== */

async function loadAllData() {

    try {

        await loadBahanBaku();

        await loadBarangJadi();

        await loadResep();

        await loadTransaksi();

        await loadPersediaan();

        await loadDashboard();

        createTransactionItemSelect();

    } catch (error) {

        console.error(
            "Gagal memuat data:",
            error
        );

        showNotification(
            "Gagal memuat data dari Supabase.",
            "error"
        );
    }

}


/* =====================================================
   NAVIGASI HALAMAN
===================================================== */

function showPage(pageId) {

    // Semua halaman disembunyikan
    const pages =
        document.querySelectorAll(".page");

    pages.forEach(function (page) {

        page.classList.remove(
            "active-page"
        );

    });


    // Halaman yang dipilih ditampilkan
    const selectedPage =
        document.getElementById(pageId);

    if (selectedPage) {

        selectedPage.classList.add(
            "active-page"
        );
    }


    // Update tombol navbar
    const buttons =
        document.querySelectorAll(
            ".nav-button"
        );

    buttons.forEach(function (button) {

        button.classList.remove("active");

    });


    buttons.forEach(function (button) {
        button.classList.toggle(
            "active",
            button.dataset.page === pageId
        );
    });

    const pageHeadings = {
        dashboard: [
            "Selamat Datang di Boutique",
            "Kelola persediaan bahan baku dan koleksi butik dalam satu tempat."
        ],
        "bahan-baku": [
            "Master Bahan Baku",
            "Pantau bahan kain, benang, kancing, dan kebutuhan produksi lainnya."
        ],
        "barang-jadi": [
            "Koleksi Barang Jadi",
            "Kelola produk butik, stok siap jual, dan harga pokok setiap koleksi."
        ],
        "bahan-habis-pakai": [
            "Bahan Habis Pakai",
            "Atur bahan yang digunakan setiap kali produk dibuat."
        ],
        transaksi: [
            "Aktivitas Persediaan",
            "Catat pembelian bahan, produksi, penjualan langsung, dan saldo persediaan."
        ],
        persediaan: [
            "Ringkasan Persediaan",
            "Lihat jumlah stok dan nilai persediaan bahan baku maupun barang jadi."
        ],
        laporan: [
            "Laporan Akuntansi",
            "Pantau penjualan tunai, HPP, laba kotor, dan jurnal umum butik."
        ]
    };
    const heading = pageHeadings[pageId];
    if (heading) {
        document.getElementById("currentPageTitle").textContent = heading[0];
        document.getElementById("currentPageDescription").textContent = heading[1];
    }

    if (pageId === "laporan") {
        loadAccountingReport();
    }

}

function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getNextCatalogCode(prefix, items, codeField) {
    const existingCodes = new Set(
        items.map(function (item) {
            return String(item[codeField] || "").toUpperCase();
        })
    );
    const codePattern = new RegExp(`^${prefix}(\\d+)$`, "i");
    let nextNumber = 1;

    items.forEach(function (item) {
        const match = String(item[codeField] || "").match(codePattern);
        if (match) {
            nextNumber = Math.max(nextNumber, Number(match[1]) + 1);
        }
    });

    let code = `${prefix}${String(nextNumber).padStart(3, "0")}`;
    while (existingCodes.has(code.toUpperCase())) {
        nextNumber += 1;
        code = `${prefix}${String(nextNumber).padStart(3, "0")}`;
    }

    return code;
}

function getMaterialCodePrefix(kind, name) {
    const materialType = String(kind || "").toLocaleLowerCase("id-ID");
    const materialName = String(name || "").toLocaleLowerCase("id-ID");
    if (/\bbenang\b/.test(`${materialType} ${materialName}`)) {
        return "BN";
    }
    if (/\bjarum\b/.test(`${materialType} ${materialName}`)) {
        return "BJ";
    }
    if (/\b(aksesoris|aksesori|accessory|accessories|resleting|ritsleting|zipper|kancing|button)\b/.test(materialType)) {
        return "BA";
    }
    if (/\b(kain|katun|denim|satin|brokat|linen|voal|cotton|fabric|sutra|silk)\b/.test(materialType)) {
        return "BK";
    }
    if (/\b(aksesoris|aksesori|accessory|accessories|resleting|ritsleting|zipper|kancing|button)\b/.test(materialName)) {
        return "BA";
    }
    if (/\b(kain|katun|denim|satin|brokat|linen|voal|cotton|fabric|sutra|silk)\b/.test(materialName)) {
        return "BK";
    }
    return null;
}

function getProductCodePrefix(category, name) {
    const description = `${category || ""} ${name || ""}`.toLocaleLowerCase("id-ID");
    if (/\bdress\b/.test(description)) {
        return "DR";
    }
    if (/\bgaun\b/.test(description)) {
        return "GN";
    }
    const clothingGroup = getClothingGroup({ kategori: category, nama_barang: name });
    if (clothingGroup === "Atasan") {
        return "AT";
    }
    if (clothingGroup === "Bawahan") {
        return "BW";
    }
    return null;
}

async function suggestCatalogCode(prefix, inputId, table, codeField) {
    const requestId = ++catalogCodeSuggestionRequest;
    const input = document.getElementById(inputId);
    input.value = "";

    if (!prefix) {
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from(table)
            .select(codeField);
        if (error) {
            throw error;
        }

        if (requestId === catalogCodeSuggestionRequest) {
            input.value = getNextCatalogCode(prefix, data || [], codeField);
        }
    } catch (error) {
        console.error("Gagal membuat saran kode katalog:", error);
        if (requestId === catalogCodeSuggestionRequest) {
            showNotification("Kode otomatis tidak dapat dibuat. Periksa koneksi lalu coba lagi.", "error");
        }
    }
}

async function loadAccountingReport() {
    const from = document.getElementById("laporanDari").value;
    const through = document.getElementById("laporanSampai").value;
    const journalBody = document.getElementById("tabelJurnal");
    const warning = document.getElementById("laporanPeringatan");
    const exportButton = document.getElementById("eksporLaporanButton");
    const csvExportButton = document.getElementById("eksporCsvButton");
    currentAccountingReport = null;
    exportButton.disabled = true;
    csvExportButton.disabled = true;

    if (!from || !through || from > through) {
        showNotification("Rentang tanggal laporan tidak valid.", "warning");
        return;
    }

    try {
        const [transactionResult, journalResult, bahanResult, barangResult] = await Promise.all([
            supabaseClient.from("transaksi")
                .select("jenis_transaksi, jumlah, nilai_bahan, nilai_persediaan, nilai_penjualan")
                .gte("tanggal", from)
                .lte("tanggal", through),
            supabaseClient.from("jurnal_umum")
                .select("id_transaksi, tanggal, akun, debit, kredit, keterangan")
                .gte("tanggal", from)
                .lte("tanggal", through)
                .order("tanggal", { ascending: true })
                .order("id_jurnal", { ascending: true }),
            supabaseClient.from("bahan_baku")
                .select("nama_bahan, satuan, stok, harga_pokok_rata_rata")
                .eq("aktif", true),
            supabaseClient.from("barang_jadi")
                .select("nama_barang, stok, harga_pokok_rata_rata")
                .eq("aktif", true)
        ]);

        [transactionResult, journalResult, bahanResult, barangResult].forEach(function (result) {
            if (result.error) throw result.error;
        });

        const transactions = transactionResult.data || [];
        const sales = transactions
            .filter((item) => item.jenis_transaksi === "KELUAR")
            .reduce((sum, item) => sum + Number(item.nilai_penjualan || 0), 0);
        const hpp = transactions
            .filter((item) => item.jenis_transaksi === "KELUAR")
            .reduce((sum, item) => sum + Number(item.nilai_persediaan || 0), 0);
        const purchases = transactions
            .filter((item) => item.jenis_transaksi === "MASUK")
            .reduce((sum, item) => sum + Number(item.nilai_persediaan || 0), 0);
        const inventoryItems = [
            ...(bahanResult.data || []).map((item) => ({
                type: "Bahan baku",
                name: item.nama_bahan,
                unit: item.satuan,
                stock: Number(item.stok),
                unitCost: Number(item.harga_pokok_rata_rata)
            })),
            ...(barangResult.data || []).map((item) => ({
                type: "Barang jadi",
                name: item.nama_barang,
                unit: "unit",
                stock: Number(item.stok),
                unitCost: Number(item.harga_pokok_rata_rata)
            }))
        ];
        const endingInventory = inventoryItems.reduce(
            (sum, item) => sum + item.stock * item.unitCost,
            0
        );
        const unvaluedItems = inventoryItems.filter(
            (item) => item.stock > 0 && item.unitCost <= 0
        );
        const legacySales = transactions.filter(
            (item) => item.jenis_transaksi === "KELUAR" && Number(item.nilai_penjualan || 0) <= 0
        ).length;
        const journal = journalResult.data || [];
        const totalDebit = journal.reduce((sum, item) => sum + Number(item.debit || 0), 0);
        const totalCredit = journal.reduce((sum, item) => sum + Number(item.kredit || 0), 0);

        document.getElementById("laporanPenjualan").textContent = formatRupiah(sales);
        document.getElementById("laporanHpp").textContent = formatRupiah(hpp);
        document.getElementById("laporanLabaKotor").textContent = formatRupiah(sales - hpp);
        document.getElementById("laporanPembelian").textContent = formatRupiah(purchases);
        document.getElementById("laporanNilaiPersediaan").textContent = formatRupiah(endingInventory);
        document.getElementById("totalDebit").textContent = formatRupiah(totalDebit);
        document.getElementById("totalKredit").textContent = formatRupiah(totalCredit);
        currentAccountingReport = {
            from: from,
            through: through,
            sales: sales,
            hpp: hpp,
            grossProfit: sales - hpp,
            purchases: purchases,
            endingInventory: endingInventory,
            totalDebit: totalDebit,
            totalCredit: totalCredit,
            inventoryItems: inventoryItems,
            journal: journal
        };
        exportButton.disabled = false;
        csvExportButton.disabled = false;

        const warnings = [];
        if (unvaluedItems.length) {
            warnings.push(
                `Stok tanpa nilai: ${unvaluedItems.map((item) => item.name).join(", ")}. Catat Penilaian Stok Lama sebelum produksi atau penjualan.`
            );
        }
        if (legacySales) {
            warnings.push(`${legacySales} transaksi penjualan lama belum memiliki nilai penjualan/HPP, sehingga laba kotor periode ini belum lengkap.`);
        }
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            warnings.push("Total debit dan kredit jurnal tidak seimbang. Periksa transaksi periode ini.");
        }
        warning.hidden = warnings.length === 0;
        warning.textContent = warnings.join(" ");

        let currentTransactionId = null;
        let transactionGroupIndex = -1;
        journalBody.innerHTML = journal.length
            ? journal.map((item) => {
                if (item.id_transaksi !== currentTransactionId) {
                    currentTransactionId = item.id_transaksi;
                    transactionGroupIndex += 1;
                }
                const rowClass = transactionGroupIndex % 2 === 0
                    ? "journal-entry-start"
                    : "journal-entry-counterpart";

                return `
                    <tr class="${rowClass}">
                        <td>${escapeHTML(item.tanggal)}</td>
                        <td>${escapeHTML(item.akun)}</td>
                        <td>${escapeHTML(item.keterangan || "-")}</td>
                        <td>${formatRupiah(item.debit)}</td>
                        <td>${formatRupiah(item.kredit)}</td>
                    </tr>
                `;
            }).join("")
            : '<tr><td colspan="5" class="empty-data">Belum ada jurnal pada periode ini.</td></tr>';
    } catch (error) {
        console.error("Gagal memuat laporan akuntansi:", error);
        showNotification(error.message || "Gagal memuat laporan akuntansi.", "error");
    }
}

function csvEscape(value) {
    let text = String(value == null ? "" : value);
    if (typeof value !== "number" && /^[\u0000-\u0020]*[=+\-@]/.test(text)) {
        text = "'" + text;
    }
    return `"${text.replace(/"/g, '""')}"`;
}

function exportAccountingCsv() {
    if (!currentAccountingReport) {
        showNotification("Tampilkan laporan terlebih dahulu sebelum mengekspor.", "warning");
        return;
    }

    const report = currentAccountingReport;
    const rows = [
        ["LAPORAN AKUNTANSI FADILAH BOUTIQUE"],
        ["Periode", report.from, "s.d.", report.through],
        [],
        ["RINGKASAN", "NILAI (Rp)"],
        ["Penjualan (Bayar Langsung)", report.sales],
        ["Harga Pokok Penjualan", report.hpp],
        ["Laba Kotor", report.grossProfit],
        ["Pembelian Bahan", report.purchases],
        ["Nilai Persediaan Saat Ini", report.endingInventory],
        ["Total Debit", report.totalDebit],
        ["Total Kredit", report.totalCredit],
        [],
        ["RINCIAN PERSEDIAAN"],
        ["Jenis", "Nama", "Stok", "Satuan", "HPP Rata-rata (Rp)", "Nilai Persediaan (Rp)"],
        ...report.inventoryItems.map((item) => [
            item.type,
            item.name,
            item.stock,
            item.unit,
            item.unitCost,
            item.stock * item.unitCost
        ]),
        [],
        ["JURNAL UMUM"],
        ["Tanggal", "Akun", "Keterangan", "Debit (Rp)", "Kredit (Rp)"],
        ...report.journal.map((item) => [
            item.tanggal,
            item.akun,
            item.keterangan || "",
            Number(item.debit || 0),
            Number(item.kredit || 0)
        ])
    ];
    const csv = "\uFEFFsep=;\r\n" + rows.map((row) => row.map(csvEscape).join(";")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `laporan-akuntansi-${report.from}-${report.through}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () {
        URL.revokeObjectURL(url);
    }, 1000);
    showNotification("Laporan CSV berhasil diunduh.", "success");
}

async function exportAccountingReport() {
    if (!currentAccountingReport) {
        showNotification("Tampilkan laporan terlebih dahulu sebelum mengekspor.", "warning");
        return;
    }

    if (!window.ExcelJS) {
        showNotification("Fitur ekspor Excel belum tersedia. Muat ulang halaman saat tersambung ke internet.", "error");
        return;
    }

    const report = currentAccountingReport;
    const exportButton = document.getElementById("eksporLaporanButton");
    exportButton.disabled = true;

    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "Fadilah Boutique";
        workbook.created = new Date();
        workbook.subject = "Laporan persediaan dan akuntansi";
        workbook.title = `Laporan Akuntansi ${report.from} - ${report.through}`;

        const colors = {
            primary: "5C1A2E",
            primaryLight: "F5E6EA",
            gold: "B8935A",
            goldLight: "F5EDE0",
            white: "FFFFFF",
            text: "29231F",
            border: "E8E0D4"
        };
        const currencyFormat = '"Rp" #,##0.00;[Red]("Rp" #,##0.00);-';
        const numberFormat = '#,##0.##;[Red](#,##0.##);-';
        const period = `Periode: ${report.from} s.d. ${report.through}`;

        function styleTitle(worksheet, lastColumn, subtitle) {
            worksheet.mergeCells(1, 1, 1, lastColumn);
            worksheet.getCell(1, 1).value = "FADILAH BOUTIQUE";
            worksheet.getCell(1, 1).font = {
                name: "Arial",
                size: 16,
                bold: true,
                color: { argb: colors.white }
            };
            worksheet.getCell(1, 1).fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: colors.primary }
            };
            worksheet.getCell(1, 1).alignment = { vertical: "middle" };
            worksheet.getRow(1).height = 30;

            worksheet.mergeCells(2, 1, 2, lastColumn);
            worksheet.getCell(2, 1).value = subtitle;
            worksheet.getCell(2, 1).font = {
                name: "Arial",
                size: 11,
                italic: true,
                color: { argb: colors.text }
            };
            worksheet.getRow(2).height = 22;
        }

        function styleSection(cell) {
            cell.font = {
                name: "Arial",
                size: 11,
                bold: true,
                color: { argb: colors.white }
            };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: colors.primary }
            };
            cell.alignment = { vertical: "middle" };
        }

        function styleTableHeader(row) {
            row.height = 24;
            row.eachCell({ includeEmpty: true }, function (cell) {
                cell.font = {
                    name: "Arial",
                    size: 10,
                    bold: true,
                    color: { argb: colors.primary }
                };
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: colors.goldLight }
                };
                cell.border = {
                    bottom: { style: "medium", color: { argb: colors.gold } }
                };
                cell.alignment = { vertical: "middle", wrapText: true };
            });
        }

        function styleDataRows(worksheet, firstRow, lastRow, lastColumn) {
            for (let rowNumber = firstRow; rowNumber <= lastRow; rowNumber += 1) {
                const row = worksheet.getRow(rowNumber);
                row.height = 21;
                for (let column = 1; column <= lastColumn; column += 1) {
                    const cell = row.getCell(column);
                    cell.font = { name: "Arial", size: 10, color: { argb: colors.text } };
                    cell.border = {
                        bottom: { style: "hair", color: { argb: colors.border } }
                    };
                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: {
                            argb: rowNumber % 2 === firstRow % 2 ? colors.white : "FAF7F2"
                        }
                    };
                }
            }
        }

        const summary = workbook.addWorksheet("Ringkasan", {
            properties: { tabColor: colors.primary },
            pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1 }
        });
        summary.columns = [
            { width: 38 },
            { width: 24 }
        ];
        styleTitle(summary, 2, `LAPORAN AKUNTANSI  |  ${period}`);
        summary.mergeCells("A4:B4");
        summary.getCell("A4").value = "RINGKASAN KEUANGAN";
        styleSection(summary.getCell("A4"));
        summary.getCell("B4").fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: colors.primary }
        };

        [
            ["Penjualan (Bayar Langsung)", report.sales],
            ["Harga Pokok Penjualan", report.hpp],
            ["Laba Kotor", report.grossProfit],
            ["Pembelian Bahan", report.purchases],
            ["Nilai Persediaan Saat Ini", report.endingInventory],
            ["Total Debit", report.totalDebit],
            ["Total Kredit", report.totalCredit]
        ].forEach(function (item) {
            summary.addRow(item);
        });
        styleDataRows(summary, 5, 11, 2);
        for (let rowNumber = 5; rowNumber <= 11; rowNumber += 1) {
            summary.getCell(rowNumber, 2).numFmt = currencyFormat;
            summary.getCell(rowNumber, 2).alignment = { horizontal: "right" };
        }
        summary.getRow(7).font = { name: "Arial", size: 10, bold: true, color: { argb: colors.primary } };
        summary.getRow(7).getCell(2).numFmt = currencyFormat;
        summary.getRow(7).getCell(2).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: colors.primaryLight }
        };
        summary.views = [{ state: "frozen", ySplit: 4 }];
        summary.printOptions = { horizontalCentered: true };
        summary.pageSetup.printArea = "A1:B11";

        const inventory = workbook.addWorksheet("Rincian Persediaan", {
            properties: { tabColor: colors.gold },
            pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 }
        });
        inventory.columns = [
            { header: "Jenis", key: "type", width: 18 },
            { header: "Nama Barang", key: "name", width: 30 },
            { header: "Stok", key: "stock", width: 14 },
            { header: "Satuan", key: "unit", width: 14 },
            { header: "HPP Rata-rata (Rp)", key: "unitCost", width: 22 },
            { header: "Nilai Persediaan (Rp)", key: "value", width: 24 }
        ];
        styleTitle(inventory, 6, `RINCIAN PERSEDIAAN  |  ${period}`);
        inventory.getRow(4).values = inventory.columns.map((column) => column.header);
        styleTableHeader(inventory.getRow(4));
        report.inventoryItems.forEach(function (item) {
            inventory.addRow({
                type: item.type,
                name: item.name,
                stock: item.stock,
                unit: item.unit,
                unitCost: item.unitCost,
                value: item.stock * item.unitCost
            });
        });
        const inventoryTotalRow = inventory.addRow([
            "TOTAL NILAI PERSEDIAAN", "", "", "", "",
            report.inventoryItems.reduce((sum, item) => sum + item.stock * item.unitCost, 0)
        ]);
        if (inventoryTotalRow.number > 5) {
            styleDataRows(inventory, 5, inventoryTotalRow.number - 1, 6);
        }
        for (let rowNumber = 5; rowNumber <= inventoryTotalRow.number; rowNumber += 1) {
            inventory.getCell(rowNumber, 3).numFmt = numberFormat;
            inventory.getCell(rowNumber, 5).numFmt = currencyFormat;
            inventory.getCell(rowNumber, 6).numFmt = currencyFormat;
            inventory.getCell(rowNumber, 3).alignment = { horizontal: "right" };
            inventory.getCell(rowNumber, 5).alignment = { horizontal: "right" };
            inventory.getCell(rowNumber, 6).alignment = { horizontal: "right" };
        }
        inventoryTotalRow.font = { name: "Arial", size: 10, bold: true, color: { argb: colors.primary } };
        inventoryTotalRow.eachCell({ includeEmpty: true }, function (cell) {
            cell.font = { name: "Arial", size: 10, bold: true, color: { argb: colors.primary } };
            cell.border = { top: { style: "medium", color: { argb: colors.gold } } };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: colors.primaryLight }
            };
        });
        inventory.autoFilter = {
            from: { row: 4, column: 1 },
            to: { row: 4 + report.inventoryItems.length, column: 6 }
        };
        inventory.views = [{ state: "frozen", ySplit: 4 }];
        inventory.pageSetup.printTitleRows = "1:4";

        const journal = workbook.addWorksheet("Jurnal Umum", {
            properties: { tabColor: "2D6A4F" },
            pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 }
        });
        journal.columns = [
            { header: "Tanggal", key: "date", width: 16 },
            { header: "Akun", key: "account", width: 30 },
            { header: "Keterangan", key: "description", width: 52 },
            { header: "Debit (Rp)", key: "debit", width: 22 },
            { header: "Kredit (Rp)", key: "credit", width: 22 }
        ];
        styleTitle(journal, 5, `JURNAL UMUM  |  ${period}`);
        journal.getRow(4).values = journal.columns.map((column) => column.header);
        styleTableHeader(journal.getRow(4));
        report.journal.forEach(function (item) {
            journal.addRow({
                date: item.tanggal,
                account: item.akun,
                description: item.keterangan || "",
                debit: Number(item.debit || 0),
                credit: Number(item.kredit || 0)
            });
        });
        const journalTotalRow = journal.addRow([
            "TOTAL", "", "",
            report.totalDebit,
            report.totalCredit
        ]);
        if (journalTotalRow.number > 5) {
            styleDataRows(journal, 5, journalTotalRow.number - 1, 5);
        }
        for (let rowNumber = 5; rowNumber <= journalTotalRow.number; rowNumber += 1) {
            journal.getCell(rowNumber, 4).numFmt = currencyFormat;
            journal.getCell(rowNumber, 5).numFmt = currencyFormat;
            journal.getCell(rowNumber, 4).alignment = { horizontal: "right" };
            journal.getCell(rowNumber, 5).alignment = { horizontal: "right" };
        }
        journalTotalRow.font = { name: "Arial", size: 10, bold: true, color: { argb: colors.primary } };
        journalTotalRow.eachCell({ includeEmpty: true }, function (cell) {
            cell.font = { name: "Arial", size: 10, bold: true, color: { argb: colors.primary } };
            cell.border = { top: { style: "medium", color: { argb: colors.gold } } };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: colors.primaryLight }
            };
        });
        journal.autoFilter = {
            from: { row: 4, column: 1 },
            to: { row: 4 + report.journal.length, column: 5 }
        };
        journal.views = [{ state: "frozen", ySplit: 4 }];
        journal.pageSetup.printTitleRows = "1:4";

        const fileContents = await workbook.xlsx.writeBuffer();
        const blob = new Blob([fileContents], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `laporan-akuntansi-${report.from}-${report.through}.xlsx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 1000);
        showNotification("Laporan Excel berhasil diunduh.", "success");
    } catch (error) {
        console.error("Gagal mengekspor laporan Excel:", error);
        showNotification("Gagal membuat file Excel. Coba muat ulang halaman lalu ekspor kembali.", "error");
    } finally {
        exportButton.disabled = !currentAccountingReport;
    }
}


/* =====================================================
   DASHBOARD
===================================================== */

async function loadDashboard() {
    try {
        const now = new Date();
        const today = formatDateForDatabase(now);
        const monthStart = formatDateForDatabase(new Date(now.getFullYear(), now.getMonth(), 1));
        const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        const activityStart = formatDateForDatabase(sevenDaysAgo);
        const [
            bahanResult,
            barangResult,
            transaksiBulanResult,
            aktivitasResult
        ] = await Promise.all([
            supabaseClient
            .from("bahan_baku")
                .select("id_bahan, nama_bahan, satuan, stok, stok_minimum", { count: "exact" })
                .eq("aktif", true)
                .order("nama_bahan", { ascending: true }),
            supabaseClient
            .from("barang_jadi")
                .select("id_barang, nama_barang, kategori, stok", { count: "exact" })
                .eq("aktif", true)
                .order("nama_barang", { ascending: true }),
            supabaseClient
            .from("transaksi")
                .select("jenis_transaksi, jumlah, id_barang, barang_jadi(nama_barang)")
                .gte("tanggal", monthStart)
                .lte("tanggal", today)
                .order("tanggal", { ascending: false }),
            supabaseClient
            .from("transaksi")
                .select("id_transaksi, tanggal, jenis_transaksi, jumlah, keterangan, bahan_baku(nama_bahan, satuan), barang_jadi(nama_barang)")
                .gte("tanggal", activityStart)
                .lte("tanggal", today)
                .order("tanggal", { ascending: false })
                .order("id_transaksi", { ascending: false })
                .limit(50)
        ]);

        [bahanResult, barangResult, transaksiBulanResult, aktivitasResult].forEach((result) => {
            if (result.error) {
                throw result.error;
            }
        });

        const bahan = bahanResult.data || [];
        const barang = barangResult.data || [];
        const transaksiBulan = transaksiBulanResult.data || [];
        const aktivitas = aktivitasResult.data || [];
        const pergerakanMasuk = transaksiBulan.filter((item) =>
            ["MASUK", "PRODUKSI", "SALDO_AWAL", "PENILAIAN_AWAL"].includes(
                String(item.jenis_transaksi || "").toUpperCase()
            )
        ).length;
        const pergerakanKeluar = transaksiBulan.filter((item) =>
            ["BAHAN_KELUAR", "KELUAR"].includes(
                String(item.jenis_transaksi || "").toUpperCase()
            )
        ).length;

        document.getElementById("totalBahanBaku").textContent = (bahanResult.count || 0).toLocaleString("id-ID");
        document.getElementById("totalBarangJadi").textContent = (barangResult.count || 0).toLocaleString("id-ID");
        document.getElementById("totalStokMasuk").textContent = pergerakanMasuk.toLocaleString("id-ID");
        document.getElementById("totalStokKeluar").textContent = pergerakanKeluar.toLocaleString("id-ID");

        renderDashboardStockChart(bahan);
        renderDashboardCategoryChart(barang);
        const lowStock = getLowStockMaterials(bahan);
        const lowStockProducts = getLowStockProducts(barang);
        renderDashboardLowStock(lowStock, lowStockProducts, bahan.length + barang.length > 0);
        const summary = document.getElementById("dashboardLowStockSummary");
        summary.textContent = lowStock.length || lowStockProducts.length
            ? `${lowStock.length} bahan baku dan ${lowStockProducts.length} barang jadi mencapai batas stok.`
            : "Tidak ada bahan baku atau barang jadi yang mencapai batas stok.";
        const signature = [
            ...lowStock.map((item) => `b:${item.id_bahan}:${item.stok}`),
            ...lowStockProducts.map((item) => `p:${item.id_barang}:${item.stok}`)
        ].join("|");
        if (signature !== lastLowStockNotificationSignature) {
            lastLowStockNotificationSignature = signature;
            if (lowStock.length || lowStockProducts.length) {
                const names = [
                    ...lowStock.map((item) => `${item.nama_bahan} (bahan baku)`),
                    ...lowStockProducts.map((item) => `${item.nama_barang} (barang jadi)`)
                ];
                const visibleNames = names.slice(0, 3).join(", ");
                const remaining = names.length > 3 ? ` dan ${names.length - 3} item lainnya` : "";
                showNotification(`Peringatan stok rendah: ${visibleNames}${remaining}.`, "warning");
            }
        }
        renderDashboardBestSellers(transaksiBulan);
        renderDashboardActivity(aktivitas);
    } catch (error) {
        console.error("Gagal memuat dashboard:", error);
        showNotification("Gagal memuat ringkasan dashboard. Periksa koneksi dan izin data.", "error");
    }
}

function formatDateForDatabase(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatDashboardQuantity(value) {
    return Number(value || 0).toLocaleString("id-ID", {
        maximumFractionDigits: 2
    });
}

function renderDashboardStockChart(bahan) {
    const container = document.getElementById("dashboardStockChart");
    if (!container) return;

    if (bahan.length === 0) {
        container.innerHTML = '<p class="dashboard-empty">Belum ada data bahan baku aktif.</p>';
        return;
    }

    const stocks = [...bahan]
        .sort((a, b) => Number(b.stok || 0) - Number(a.stok || 0))
        .slice(0, 5);
    const maximum = Math.max(...stocks.map((item) => Number(item.stok || 0)), 1);

    container.innerHTML = stocks.map((item) => {
        const stock = Number(item.stok || 0);
        const width = Math.max(stock > 0 ? 4 : 0, (stock / maximum) * 100);
        return `
            <div class="stock-chart-row">
                <div class="stock-chart-label">
                    <span>${escapeHTML(item.nama_bahan)}</span>
                    <strong>${formatDashboardQuantity(stock)} ${escapeHTML(item.satuan || "")}</strong>
                </div>
                <div class="stock-chart-track" role="img" aria-label="${escapeHTML(item.nama_bahan)}: ${formatDashboardQuantity(stock)} ${escapeHTML(item.satuan || "")}">
                    <span style="width:${width}%"></span>
                </div>
            </div>
        `;
    }).join("");
}

function renderDashboardCategoryChart(barang) {
    const container = document.getElementById("dashboardCategoryChart");
    if (!container) return;

    if (barang.length === 0) {
        container.innerHTML = '<p class="dashboard-empty">Belum ada koleksi barang jadi aktif.</p>';
        return;
    }

    const categories = new Map([
        ["Atasan", 0],
        ["Bawahan", 0]
    ]);
    barang.forEach((item) => {
        const category = getClothingGroup(item);
        categories.set(category, (categories.get(category) || 0) + 1);
    });

    const palette = ["#5c1a2e", "#c49863", "#a45b68"];
    let offset = 0;
    const entries = [...categories.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count], index) => {
            const start = offset;
            offset += (count / barang.length) * 100;
            return { name, count, color: palette[index % palette.length], start, end: offset };
        });
    const gradient = entries
        .map((item) => `${item.color} ${item.start}% ${item.end}%`)
        .join(", ");
    const total = entries.reduce((sum, item) => sum + item.count, 0);

    container.innerHTML = `
        <div class="category-chart-layout">
            <div class="category-donut" role="img" aria-label="Komposisi koleksi: ${entries.map((item) => `${item.name} ${item.count}`).join(", ")}" style="background:conic-gradient(${gradient})">
                <span>${total}<small>produk</small></span>
            </div>
            <ul class="category-legend">
                ${entries.map((item) => `
                    <li>
                        <span class="category-swatch" style="--category-color:${item.color}"></span>
                        <span class="category-name">${escapeHTML(item.name)}</span>
                        <strong>${item.count}</strong>
                    </li>
                `).join("")}
            </ul>
        </div>
    `;
}

function getClothingGroup(item) {
    const category = String(item.kategori || "").trim().toLocaleLowerCase("id-ID");
    if (category === "atasan" || category === "bawahan") {
        return category === "atasan" ? "Atasan" : "Bawahan";
    }

    const description = `${category} ${String(item.nama_barang || "").toLocaleLowerCase("id-ID")}`;
    if (/\b(blouse|blus|jaket|jacket|blazer|outer|vest|kemeja|kaos|tunik|sweater|cardigan|hoodie|atasan)\b/.test(description)) {
        return "Atasan";
    }
    if (/\b(rok|celana|jeans|kulot|legging|shorts|skirt|trouser|pants|bawahan)\b/.test(description)) {
        return "Bawahan";
    }
    return "Lainnya";
}

function getMaterialMinimumStock() {
    return 5;
}

function getLowStockProducts(barang) {
    return barang
        .filter((item) => Number(item.stok || 0) <= 1)
        .sort((a, b) => Number(a.stok || 0) - Number(b.stok || 0));
}

function getLowStockMaterials(bahan) {
    return bahan
        .filter((item) => Number(item.stok || 0) <= getMaterialMinimumStock())
        .sort((a, b) => Number(a.stok || 0) - Number(b.stok || 0));
}

function renderDashboardLowStock(lowStock, lowStockProducts, hasInventory) {
    const container = document.getElementById("dashboardLowStock");
    if (!container) return;

    const items = [
        ...lowStock.map((item) => ({
            name: item.nama_bahan,
            type: "Bahan baku",
            stock: item.stok,
            unit: item.satuan
        })),
        ...lowStockProducts.map((item) => ({
            name: item.nama_barang,
            type: "Barang jadi",
            stock: item.stok,
            unit: "pcs"
        }))
    ];

    if (items.length === 0) {
        container.innerHTML = hasInventory
            ? '<p class="dashboard-empty">Tidak ada stok yang mencapai batas minimum.</p>'
            : '<p class="dashboard-empty">Belum ada persediaan aktif.</p>';
        return;
    }

    container.innerHTML = items.slice(0, 6).map((item) => `
        <div class="dashboard-list-row low-stock-row">
            <span class="dashboard-alert-dot" aria-hidden="true"></span>
            <span class="dashboard-list-name">${escapeHTML(item.name)} <small>${escapeHTML(item.type)}</small></span>
            <strong>${formatDashboardQuantity(item.stock)} ${escapeHTML(item.unit || "")}</strong>
        </div>
    `).join("");
}

function renderDashboardBestSellers(transaksi) {
    const container = document.getElementById("dashboardBestSellers");
    if (!container) return;

    const products = new Map();
    transaksi
        .filter((item) => String(item.jenis_transaksi || "").toUpperCase() === "KELUAR" && item.id_barang)
        .forEach((item) => {
            const entry = products.get(item.id_barang) || {
                name: item.barang_jadi?.nama_barang || "Barang jadi",
                quantity: 0
            };
            entry.quantity += Number(item.jumlah || 0);
            products.set(item.id_barang, entry);
        });

    const bestSellers = [...products.values()]
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

    if (bestSellers.length === 0) {
        container.innerHTML = '<p class="dashboard-empty">Belum ada transaksi penjualan bulan ini.</p>';
        return;
    }

    container.innerHTML = bestSellers.map((item, index) => `
        <div class="dashboard-list-row">
            <span class="best-seller-rank">${index + 1}</span>
            <span class="dashboard-list-name">${escapeHTML(item.name)}</span>
            <strong>${formatDashboardQuantity(item.quantity)} unit</strong>
        </div>
    `).join("");
}

function renderDashboardActivity(aktivitas) {
    const container = document.getElementById("dashboardRecentActivity");
    if (!container) return;

    const labels = {
        MASUK: "Bahan masuk",
        BAHAN_KELUAR: "Bahan keluar",
        PRODUKSI: "Produksi",
        KELUAR: "Penjualan",
        SALDO_AWAL: "Saldo awal",
        PENILAIAN_AWAL: "Penilaian stok"
    };

    if (aktivitas.length === 0) {
        container.innerHTML = '<tr><td class="dashboard-empty" colspan="5">Belum ada aktivitas dalam 7 hari terakhir.</td></tr>';
        return;
    }

    container.innerHTML = aktivitas.slice(0, 10).map((item) => {
        const type = String(item.jenis_transaksi || "").toUpperCase();
        const product = item.barang_jadi?.nama_barang;
        const material = item.bahan_baku?.nama_bahan;
        const itemName = product || material || item.keterangan || "-";
        const unit = product ? "unit" : (item.bahan_baku?.satuan || "");
        const date = item.tanggal
            ? new Date(`${item.tanggal}T00:00:00`).toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            })
            : "-";
        return `
            <tr>
                <td>${escapeHTML(date)}</td>
                <td><span class="activity-type activity-${type.toLowerCase()}">${escapeHTML(labels[type] || type)}</span></td>
                <td>${escapeHTML(itemName)}</td>
                <td>${formatDashboardQuantity(item.jumlah)} ${escapeHTML(unit)}</td>
                <td><span class="activity-status">Selesai</span></td>
            </tr>
        `;
    }).join("");
}


/* =====================================================
   BAHAN BAKU
===================================================== */

async function loadBahanBaku() {

    const {
        data,
        error
    } = await supabaseClient
        .from("bahan_baku")
        .select("*")
        .eq("aktif", true)
        .order("id_bahan", {
            ascending: true
        });


    if (error) {

        console.error(
            "Gagal mengambil bahan baku:",
            error
        );

        showNotification(
            "Gagal mengambil data bahan baku.",
            "error"
        );

        return;
    }


    dataBahanBaku = data || [];

    renderBahanBaku();
    populateRecipeOptions();
}


/* =====================================================
   TAMPILKAN BAHAN BAKU
===================================================== */

function renderBahanBaku(
    data = dataBahanBaku
) {

    const tabel =
        document.getElementById(
            "tabelBahanBaku"
        );

    if (!tabel) {
        return;
    }


    if (data.length === 0) {

        tabel.innerHTML = `
            <tr>
                <td
                    colspan="8"
                    class="empty-data">
                    Belum ada data bahan baku.
                </td>
            </tr>
        `;

        return;
    }


    tabel.innerHTML = "";


    data.forEach(function (item, index) {

        let stokClass =
            "stok-aman";


        if (Number(item.stok) === 0) {

            stokClass =
                "stok-habis";

        } else if (
            Number(item.stok) <= getMaterialMinimumStock()
        ) {

            stokClass =
                "stok-sedikit";

        }


        tabel.innerHTML += `

            <tr>

                <td>
                    ${index + 1}
                </td>

                <td>
                    ${escapeHTML(
                        item.kode_bahan
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.nama_bahan
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.jenis_bahan || "-"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.satuan
                    )}
                </td>

                <td
                    class="${stokClass}">
                    ${item.stok}
                </td>

                <td>${formatRupiah(item.harga_pokok_rata_rata)}</td>

                <td>

                    <button
                        class="btn btn-warning btn-small"
                        onclick="editBahanBaku(${item.id_bahan})">

                        Edit

                    </button>


                    <button
                        class="btn btn-danger btn-small"
                        onclick="deleteBahanBaku(${item.id_bahan})">

                        Hapus

                    </button>

                </td>

            </tr>

        `;

    });

}


/* =====================================================
   FORM BAHAN BAKU
===================================================== */

function openBahanBakuForm() {

    editBahanBakuId = null;

    document.getElementById(
        "formBahanBaku"
    ).classList.remove("hidden");


    document.getElementById(
        "bahanBakuForm"
    ).reset();


    document.getElementById("kodeBahan").value = "";


    document.querySelector(
        "#formBahanBaku h3"
    ).textContent =
        "Tambah Bahan Baku";

}


function closeBahanBakuForm() {

    editBahanBakuId = null;

    document.getElementById(
        "formBahanBaku"
    ).classList.add("hidden");

}


/* =====================================================
   SIMPAN BAHAN BAKU
===================================================== */

async function saveBahanBaku(event) {

    event.preventDefault();


    const kode =
        document.getElementById(
            "kodeBahan"
        ).value.trim();


    const nama =
        document.getElementById(
            "namaBahan"
        ).value.trim();


    const jenis =
        document.getElementById(
            "jenisBahan"
        ).value.trim();


    const satuan =
        document.getElementById(
            "satuanBahan"
        ).value;

    if (
        !kode ||
        !nama ||
        !jenis ||
        !satuan
    ) {

        showNotification(
            "Lengkapi data bahan baku. Isi jenis bahan agar kode dapat dibuat otomatis.",
            "warning"
        );

        return;
    }

    try {

        if (editBahanBakuId) {

            // UPDATE

            const {
                error
            } = await supabaseClient
                .from("bahan_baku")
                .update({
                    kode_bahan: kode,
                    nama_bahan: nama,
                    jenis_bahan: jenis,
                    satuan: satuan,
                    stok_minimum: 5
                })
                .eq(
                    "id_bahan",
                    editBahanBakuId
                );


            if (error) {
                throw error;
            }


            showNotification(
                "Data bahan baku berhasil diperbarui.",
                "success"
            );

        } else {

            // INSERT

            const { error } = await supabaseClient
                .from("bahan_baku")
                .insert([{
                    kode_bahan: kode,
                    nama_bahan: nama,
                    jenis_bahan: jenis,
                    satuan: satuan,
                    stok: 0,
                    stok_minimum: 5,
                    harga_pokok_rata_rata: 0
                }]);


            if (error) {
                throw error;
            }

            showNotification(
                "Bahan baku berhasil ditambahkan. Catat stok awal melalui menu Transaksi.",
                "success"
            );

        }


        closeBahanBakuForm();

        await loadBahanBaku();

        await loadResep();

        await loadPersediaan();

        await loadDashboard();

        createTransactionItemSelect();


    } catch (error) {

        console.error(error);

        if (
            error.code === "23505"
        ) {
            showNotification("Kode bahan sudah digunakan. Masukkan kode lain.", "error");

        } else {

            showNotification(
                "Gagal menyimpan bahan baku.",
                "error"
            );

        }

    }

}


/* =====================================================
   EDIT BAHAN BAKU
===================================================== */

async function editBahanBaku(id) {

    const item =
        dataBahanBaku.find(
            function (data) {
                return data.id_bahan === id;
            }
        );


    if (!item) {
        return;
    }


    editBahanBakuId = id;


    document.getElementById(
        "formBahanBaku"
    ).classList.remove("hidden");


    document.querySelector(
        "#formBahanBaku h3"
    ).textContent =
        "Edit Bahan Baku";


    document.getElementById(
        "kodeBahan"
    ).value =
        item.kode_bahan;


    document.getElementById(
        "namaBahan"
    ).value =
        item.nama_bahan;


    document.getElementById(
        "jenisBahan"
    ).value =
        item.jenis_bahan || "";


    document.getElementById(
        "satuanBahan"
    ).value =
        item.satuan;

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


/* =====================================================
   HAPUS BAHAN BAKU
===================================================== */

async function deleteBahanBaku(id) {

    const yakin =
        confirm(
            "Bahan yang belum dipakai akan dihapus. Bahan yang punya transaksi atau resep akan diarsipkan agar riwayat tetap aman. Lanjutkan?"
        );


    if (!yakin) {
        return;
    }


    try {

        const [transaksiResult, resepResult] = await Promise.all([
            supabaseClient
                .from("transaksi")
                .select("id_transaksi", { count: "exact", head: true })
                .eq("id_bahan", id),
            supabaseClient
                .from("detail_produksi")
                .select("id_detail", { count: "exact", head: true })
                .eq("id_bahan", id)
        ]);

        if (transaksiResult.error) throw transaksiResult.error;
        if (resepResult.error) throw resepResult.error;
        if (transaksiResult.count === null || resepResult.count === null) {
            throw new Error("Tidak dapat memeriksa transaksi dan resep bahan baku.");
        }

        let diarsipkan = transaksiResult.count > 0 || resepResult.count > 0;

        if (diarsipkan) {
            const { error } = await supabaseClient
                .from("bahan_baku")
                .update({ aktif: false })
                .eq("id_bahan", id);

            if (error) throw error;
        } else {
            const { error } = await supabaseClient
                .from("bahan_baku")
                .delete()
                .eq("id_bahan", id);

            if (error && error.code === "23503") {
                const { error: archiveError } = await supabaseClient
                    .from("bahan_baku")
                    .update({ aktif: false })
                    .eq("id_bahan", id);

                if (archiveError) throw archiveError;
                diarsipkan = true;
            } else if (error) {
                throw error;
            }
        }


        showNotification(
            diarsipkan
                ? "Bahan baku diarsipkan. Riwayat dan resep lama tetap tersimpan."
                : "Bahan baku berhasil dihapus.",
            "success"
        );


        await loadBahanBaku();

        await loadResep();

        await loadPersediaan();

        await loadDashboard();

        createTransactionItemSelect();


    } catch (error) {

        console.error(error);

        showNotification(
            error.message || "Gagal menghapus atau mengarsipkan bahan baku.",
            "error"
        );

    }

}


/* =====================================================
   SEARCH BAHAN BAKU
===================================================== */

function searchBahanBaku() {

    const keyword =
        document.getElementById(
            "searchBahanBaku"
        ).value
        .toLowerCase()
        .trim();


    const filtered =
        dataBahanBaku.filter(
            function (item) {

                return (

                    item.kode_bahan
                        .toLowerCase()
                        .includes(keyword)

                    ||

                    item.nama_bahan
                        .toLowerCase()
                        .includes(keyword)

                    ||

                    (
                        item.jenis_bahan || ""
                    )
                        .toLowerCase()
                        .includes(keyword)

                );

            }
        );


    renderBahanBaku(filtered);

}


/* =====================================================
   BARANG JADI
===================================================== */

async function loadBarangJadi() {

    const {
        data,
        error
    } = await supabaseClient
        .from("barang_jadi")
        .select("*")
        .eq("aktif", true)
        .order("id_barang", {
            ascending: true
        });


    if (error) {

        console.error(
            "Gagal mengambil barang jadi:",
            error
        );

        showNotification(
            "Gagal mengambil data barang jadi.",
            "error"
        );

        return;
    }


    dataBarangJadi = data || [];

    renderBarangJadi();
    populateRecipeOptions();

}


/* =====================================================
   TAMPILKAN BARANG JADI
===================================================== */

function renderBarangJadi(
    data = dataBarangJadi
) {

    const tabel =
        document.getElementById(
            "tabelBarangJadi"
        );


    if (!tabel) {
        return;
    }


    if (data.length === 0) {

        tabel.innerHTML = `
            <tr>
                <td
                    colspan="11"
                    class="empty-data">
                    Belum ada data barang jadi.
                </td>
            </tr>
        `;

        return;
    }


    tabel.innerHTML = "";


    data.forEach(function (item, index) {

        let stokClass =
            "stok-aman";


        if (Number(item.stok) === 0) {

            stokClass =
                "stok-habis";

        } else if (Number(item.stok) <= 1) {

            stokClass =
                "stok-sedikit";

        }


        tabel.innerHTML += `

            <tr>

                <td>
                    ${index + 1}
                </td>

                <td>
                    ${escapeHTML(
                        item.kode_barang
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.nama_barang
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.kategori || "-"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.ukuran || "-"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.warna || "-"
                    )}
                </td>

                <td
                    class="${stokClass}">
                    ${item.stok}
                </td>

                <td>
                    ${formatRupiah(
                        item.harga_jual
                    )}
                </td>

                <td>${Number(item.stok) > 0 || Number(item.harga_pokok_rata_rata) > 0
                    ? formatRupiah(item.harga_pokok_rata_rata)
                    : "-"}</td>

                <td>${formatRecipeUnitCost(getRecipeUnitCost(item.id_barang))}</td>

                <td>

                    <button
                        class="btn btn-warning btn-small"
                        onclick="editBarangJadi(${item.id_barang})">

                        Edit

                    </button>


                    <button
                        class="btn btn-danger btn-small"
                        onclick="deleteBarangJadi(${item.id_barang})">

                        Hapus

                    </button>

                </td>

            </tr>

        `;

    });

}


/* =====================================================
   FORM BARANG JADI
===================================================== */

function openBarangJadiForm() {

    editBarangJadiId = null;


    document.getElementById(
        "formBarangJadi"
    ).classList.remove("hidden");


    document.getElementById(
        "barangJadiForm"
    ).reset();


    document.getElementById("kodeBarang").value = "";

    document.querySelector(
        "#formBarangJadi h3"
    ).textContent =
        "Tambah Barang Jadi";

}


function closeBarangJadiForm() {

    editBarangJadiId = null;

    document.getElementById(
        "formBarangJadi"
    ).classList.add("hidden");

}


/* =====================================================
   SIMPAN BARANG JADI
===================================================== */

async function saveBarangJadi(event) {

    event.preventDefault();

    const kode =
        document.getElementById(
            "kodeBarang"
        ).value.trim();
    const nama =
        document.getElementById(
            "namaBarang"
        ).value.trim();
    const kategori =
        document.getElementById(
            "kategoriBarang"
        ).value.trim();
    const ukuran =
        document.getElementById(
            "ukuranBarang"
        ).value;
    const warna =
        document.getElementById(
            "warnaBarang"
        ).value.trim();
    const harga =
        Number(
            document.getElementById(
                "hargaBarang"
            ).value
        );
    if (
        !kode ||
        !nama ||
        !kategori ||
        !ukuran ||
        !warna ||
        !Number.isFinite(harga) ||
        harga < 0 ||
        !["Atasan", "Bawahan"].includes(kategori)
    ) {
        showNotification(
            "Lengkapi data barang jadi, pilih kelompok pakaian, dan pastikan harga tidak negatif.",
            "warning"
        );
        return;
    }

    if (editBarangJadiId) {
        try {
            const { error } = await supabaseClient
                .from("barang_jadi")
                .update({
                    kode_barang: kode,
                    nama_barang: nama,
                    kategori: kategori,
                    ukuran: ukuran,
                    warna: warna,
                    harga_jual: harga
                })
                .eq("id_barang", editBarangJadiId);
            if (error) throw error;

            showNotification("Data barang jadi berhasil diperbarui. Perubahan stok dicatat melalui menu Transaksi.", "success");
        } catch (error) {
            console.error(error);
            showNotification(
                error.code === "23505"
                    ? "Kode barang sudah digunakan. Masukkan kode lain."
                    : error.message || "Gagal memperbarui barang jadi.",
                "error"
            );
            return;
        }
    } else {
        try {
            const { error } = await supabaseClient
                .from("barang_jadi")
                .insert([{
                    kode_barang: kode,
                    nama_barang: nama,
                    kategori: kategori,
                    ukuran: ukuran,
                    warna: warna,
                    stok: 0,
                    harga_pokok_rata_rata: 0,
                    harga_jual: harga
                }]);
            if (error) throw error;
        } catch (error) {
            console.error(error);
            if (error.code === "23505") {
                showNotification("Kode barang sudah digunakan. Masukkan kode lain.", "error");
            } else {
                const detailError = [error.message, error.details, error.hint]
                    .filter(Boolean)
                    .join(" ");
                showNotification(detailError || "Gagal menyimpan barang jadi.", "error");
            }
            return;
        }

        showNotification(
            "Barang jadi berhasil disimpan. Tambahkan bahan produksinya melalui menu Bahan Habis Pakai.",
            "success"
        );
    }

    closeBarangJadiForm();
    await loadBarangJadi();
    await loadResep();
    await loadPersediaan();
    await loadDashboard();
    createTransactionItemSelect();

}


/* =====================================================
   EDIT BARANG JADI
===================================================== */

async function editBarangJadi(id) {

    const item =
        dataBarangJadi.find(
            function (data) {
                return data.id_barang === id;
            }
        );


    if (!item) {
        return;
    }

    const kelompokPakaian = getClothingGroup(item);

    editBarangJadiId = id;


    document.getElementById(
        "formBarangJadi"
    ).classList.remove("hidden");

    document.querySelector(
        "#formBarangJadi h3"
    ).textContent =
        "Edit Barang Jadi";


    document.getElementById(
        "kodeBarang"
    ).value =
        item.kode_barang;


    document.getElementById(
        "namaBarang"
    ).value =
        item.nama_barang;


    document.getElementById(
        "kategoriBarang"
    ).value =
        kelompokPakaian === "Lainnya" ? "" : kelompokPakaian;


    document.getElementById(
        "ukuranBarang"
    ).value =
        item.ukuran || "";


    document.getElementById(
        "warnaBarang"
    ).value =
        item.warna || "";


    document.getElementById(
        "hargaBarang"
    ).value =
        item.harga_jual;

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


/* =====================================================
   HAPUS BARANG JADI
===================================================== */

async function deleteBarangJadi(id) {

    const yakin =
        confirm(
            "Barang tanpa riwayat transaksi akan dihapus. Barang yang punya riwayat transaksi akan diarsipkan agar histori tetap tersimpan. Lanjutkan?"
        );


    if (!yakin) {
        return;
    }


    try {

        const { count, error: historyError } = await supabaseClient
            .from("transaksi")
            .select("id_transaksi", {
                count: "exact",
                head: true
            })
            .eq("id_barang", id);

        if (historyError) {
            throw historyError;
        }

        if (count === null) {
            throw new Error("Tidak dapat memeriksa riwayat transaksi barang.");
        }

        let diarsipkan = count > 0;

        if (diarsipkan) {
            const { error } = await supabaseClient
                .from("barang_jadi")
                .update({ aktif: false })
                .eq("id_barang", id);

            if (error) {
                throw error;
            }
        } else {
            const { error } = await supabaseClient
            .from("barang_jadi")
            .delete()
            .eq("id_barang", id);

            if (error && error.code === "23503") {
                const { error: archiveError } = await supabaseClient
                    .from("barang_jadi")
                    .update({ aktif: false })
                    .eq("id_barang", id);

                if (archiveError) {
                    throw archiveError;
                }

                diarsipkan = true;
            } else if (error) {
                throw error;
            }
        }

        showNotification(
            diarsipkan
                ? "Barang diarsipkan. Riwayat transaksinya tetap tersimpan."
                : "Barang jadi berhasil dihapus.",
            "success"
        );


        await loadBarangJadi();

        await loadResep();

        await loadPersediaan();

        await loadDashboard();

        createTransactionItemSelect();


    } catch (error) {

        console.error(error);

        showNotification(
            error.message || "Gagal menghapus atau mengarsipkan barang jadi.",
            "error"
        );

    }

}


/* =====================================================
   SEARCH BARANG JADI
===================================================== */

function searchBarangJadi() {

    const keyword =
        document.getElementById(
            "searchBarangJadi"
        ).value
        .toLowerCase()
        .trim();


    const filtered =
        dataBarangJadi.filter(
            function (item) {

                return (

                    item.kode_barang
                        .toLowerCase()
                        .includes(keyword)

                    ||

                    item.nama_barang
                        .toLowerCase()
                        .includes(keyword)

                    ||

                    (
                        item.kategori || ""
                    )
                        .toLowerCase()
                        .includes(keyword)

                    ||

                    (
                        item.warna || ""
                    )
                        .toLowerCase()
                        .includes(keyword)

                );

            }
        );


    renderBarangJadi(filtered);

}


async function loadResep() {

    const { data, error } = await supabaseClient
        .from("detail_produksi")
        .select("*, bahan_baku(nama_bahan, satuan, aktif, harga_pokok_rata_rata), barang_jadi(nama_barang, kode_barang)")
        .order("id_detail", { ascending: true });

    if (error) {
        console.error("Gagal mengambil resep produksi:", error);
        showNotification(error.message || "Gagal mengambil resep produksi.", "error");
        return;
    }

    dataResep = data || [];
    renderResep();
    populateRecipeOptions();
    renderBarangJadi();
    createTransactionItemSelect();
}

function getRecipeUnitCost(idBarang) {
    const recipe = dataResep.filter((item) => Number(item.id_barang) === Number(idBarang));
    if (recipe.length === 0) return null;

    let total = 0;
    for (const item of recipe) {
        if (item.bahan_baku && item.bahan_baku.aktif === false) return null;
        const unitCost = Number(item.bahan_baku && item.bahan_baku.harga_pokok_rata_rata || 0);
        if (unitCost <= 0) return null;
        total += Number(item.jumlah_digunakan) * unitCost;
    }

    return total;
}

function formatRecipeUnitCost(value) {
    return value === null
        ? '<span title="Lengkapi resep dan nilai persediaan bahan baku terlebih dahulu">Belum dapat dihitung</span>'
        : formatRupiah(value);
}

function renderResep() {

    const tabel = document.getElementById("tabelResep");
    if (!tabel) return;

    if (dataResep.length === 0) {
        tabel.innerHTML = '<tr><td colspan="5" class="empty-data">Belum ada bahan untuk produksi.</td></tr>';
        return;
    }

    tabel.innerHTML = dataResep.map(function (item, index) {
        const barang = item.barang_jadi ? item.barang_jadi.nama_barang : "-";
        const bahan = item.bahan_baku ? item.bahan_baku.nama_bahan : "-";
        const satuan = item.bahan_baku ? item.bahan_baku.satuan : "";

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHTML(item.barang_jadi ? `${item.barang_jadi.kode_barang} - ${barang}` : barang)}</td>
                <td>${escapeHTML(bahan)}</td>
                <td>${escapeHTML(item.jumlah_digunakan)} ${escapeHTML(satuan)}</td>
                <td><button class="btn btn-danger btn-small" onclick="deleteResep(${item.id_detail})">Hapus</button></td>
            </tr>
        `;
    }).join("");
}


function populateRecipeOptions() {

    const barangSelect = document.getElementById("barangResep");
    const bahanSelect = document.getElementById("bahanResep");
    if (!barangSelect || !bahanSelect) return;

    barangSelect.innerHTML = '<option value="">-- Pilih Barang --</option>';
    bahanSelect.innerHTML = '<option value="">-- Pilih Bahan --</option>';

    dataBarangJadi.forEach(function (item) {
        barangSelect.add(new Option(`${item.kode_barang} - ${item.nama_barang}`, item.id_barang));
    });

    dataBahanBaku.forEach(function (item) {
        bahanSelect.add(new Option(`${item.kode_bahan} - ${item.nama_bahan}`, item.id_bahan));
    });
}


async function saveResep(event) {

    event.preventDefault();

    const payload = {
        id_barang: Number(document.getElementById("barangResep").value),
        id_bahan: Number(document.getElementById("bahanResep").value),
        jumlah_digunakan: Number(document.getElementById("jumlahBahanResep").value)
    };

    if (
        !payload.id_barang ||
        !payload.id_bahan ||
        !Number.isFinite(payload.jumlah_digunakan) ||
        payload.jumlah_digunakan <= 0
    ) {
        showNotification("Pilih produk, bahan, dan jumlah yang valid.", "warning");
        return;
    }

    const { error } = await supabaseClient
        .from("detail_produksi")
        .insert([payload]);

    if (error) {
        showNotification(
            error.code === "23505"
                ? "Bahan tersebut sudah ada pada resep produk ini."
                : error.message || "Gagal menyimpan bahan habis pakai.",
            "error"
        );
        return;
    }

    document.getElementById("resepForm").reset();
    document.getElementById("resepForm").dataset.dirty = "false";
    showNotification("Bahan habis pakai berhasil ditambahkan dan akan digunakan saat produksi.", "success");
    await loadResep();
}


async function deleteResep(id) {

    if (!confirm("Hapus bahan habis pakai ini dari produk?")) return;

    const { error } = await supabaseClient
        .from("detail_produksi")
        .delete()
        .eq("id_detail", id);

    if (error) {
        showNotification(error.message || "Gagal menghapus bahan habis pakai.", "error");
        return;
    }

    showNotification("Bahan habis pakai berhasil dihapus.", "success");
    await loadResep();
}


function syncTransactionForm() {
    createTransactionItemSelect();
    syncTransactionQuantity();
    syncTransactionFields();
    syncTransactionItemDetails();
    updateTransactionPreview();
}

function syncTransactionQuantity() {
    const type = document.getElementById("jenisTransaksi").value;
    const selectedItemType = document.getElementById("itemTransaksi").value.split("-")[0];
    const materialTransaction = ["masuk", "bahan_keluar"].includes(type) ||
        (["saldo_awal", "penilaian_awal"].includes(type) && selectedItemType === "bahan");
    const quantity = document.getElementById("jumlahTransaksi");
    quantity.min = materialTransaction ? "0.01" : "1";
    quantity.step = materialTransaction ? "0.01" : "1";
}

function syncTransactionFields() {
    const type = document.getElementById("jenisTransaksi").value;
    const purchase = type === "masuk";
    const sale = type === "keluar";
    const opening = type === "saldo_awal";
    const valuation = type === "penilaian_awal";
    const purchasePrice = document.getElementById("hargaPerolehanTransaksi");
    const salePrice = document.getElementById("hargaJualTransaksi");
    const payment = document.getElementById("metodePembayaranTransaksi");
    const quantity = document.getElementById("jumlahTransaksi");

    document.getElementById("hargaPerolehanWrapper").hidden = !(purchase || opening || valuation);
    document.querySelector('#hargaPerolehanWrapper label').textContent =
        purchase ? "Harga Beli per Satuan (Rp)" : "Harga Pokok per Satuan (Rp)";
    document.getElementById("hargaJualWrapper").hidden = !sale;
    document.getElementById("metodePembayaranWrapper").hidden = !(purchase || sale);

    purchasePrice.required = purchase || opening || valuation;
    salePrice.required = sale;
    payment.required = purchase || sale;

    quantity.readOnly = valuation;
    document.querySelector('label[for="jumlahTransaksi"]').textContent =
        valuation ? "Stok Saat Ini (tidak berubah)" : "Jumlah";

}

function syncTransactionItemDetails() {
    const type = document.getElementById("jenisTransaksi").value;
    const picker = document.getElementById("itemTransaksi");
    if (!picker || !picker.value) return;

    if (type === "penilaian_awal") {
        const [itemType, id] = picker.value.split("-");
        const records = itemType === "bahan" ? dataBahanBaku : dataBarangJadi;
        const idField = itemType === "bahan" ? "id_bahan" : "id_barang";
        const record = records.find((item) => String(item[idField]) === id);
        if (record) {
            document.getElementById("jumlahTransaksi").value = record.stok;
            document.getElementById("jumlahTransaksi").min = record.stok || "0";
            document.getElementById("hargaPerolehanTransaksi").value =
                record.harga_pokok_rata_rata > 0 ? record.harga_pokok_rata_rata : "";
        }
    } else if (type === "keluar") {
        const id = Number(picker.value.split("-")[1]);
        const record = dataBarangJadi.find((item) => Number(item.id_barang) === id);
        if (record) document.getElementById("hargaJualTransaksi").value = record.harga_jual || "";
    }

    updateTransactionPreview();
}

function updateTransactionPreview() {
    const preview = document.getElementById("nilaiTransaksiPreview");
    if (!preview) return;

    const type = document.getElementById("jenisTransaksi").value;
    const quantity = Number(document.getElementById("jumlahTransaksi").value);
    const purchasePrice = Number(document.getElementById("hargaPerolehanTransaksi").value);
    const salePrice = Number(document.getElementById("hargaJualTransaksi").value);
    const picker = document.getElementById("itemTransaksi");
    const selected = picker && picker.value ? picker.value.split("-") : [];
    const itemId = selected.length === 2 ? Number(selected[1]) : 0;
    const selectedItem = selected[0] === "bahan"
        ? dataBahanBaku.find((item) => Number(item.id_bahan) === itemId)
        : dataBarangJadi.find((item) => Number(item.id_barang) === itemId);

    if (!type) {
        preview.textContent = "Pilih jenis transaksi terlebih dahulu. Kolom nilai dan HPP akan muncul setelah jenis transaksi dipilih.";
        return;
    }

    if (["masuk", "saldo_awal", "penilaian_awal"].includes(type)) {
        const amount = quantity * purchasePrice;
        const label = type === "masuk" ? "Nilai pembelian bahan" : "Nilai persediaan";
        preview.textContent = amount > 0
            ? `${label}: ${formatRupiah(amount)} (${quantity} × ${formatRupiah(purchasePrice)} per satuan)`
            : "Isi jumlah dan harga perolehan per satuan untuk melihat total nilai persediaan.";
        return;
    } else if (type === "bahan_keluar") {
        const unitCost = Number(selectedItem && selectedItem.harga_pokok_rata_rata || 0);
        const amount = quantity * unitCost;
        preview.textContent = amount > 0
            ? `Nilai bahan yang dipakai: ${formatRupiah(amount)} (${quantity} × ${formatRupiah(unitCost)} per satuan)`
            : "Nilai pemakaian bahan belum dapat dihitung. Pilih bahan yang sudah dinilai dan isi jumlah.";
        return;
    } else if (type === "keluar") {
        const revenue = quantity * salePrice;
        const unitCost = Number(selectedItem && selectedItem.harga_pokok_rata_rata || 0);
        if (quantity <= 0 || salePrice <= 0) {
            preview.textContent = "Isi jumlah dan harga jual per unit. Sistem menghitung HPP dari HPP rata-rata barang jadi.";
            return;
        }

        const hpp = unitCost > 0 ? quantity * unitCost : null;
        const grossProfit = hpp === null ? null : revenue - hpp;
        preview.textContent = [
            `Nominal penjualan: ${formatRupiah(revenue)}`,
            hpp === null ? "HPP belum dapat dihitung: nilai stok barang jadi belum tersedia." : `HPP: ${formatRupiah(hpp)}`,
            grossProfit === null ? "" : `Perkiraan laba kotor: ${formatRupiah(grossProfit)}`
        ].filter(Boolean).join(" | ");
        return;
    } else if (type === "produksi") {
        if (quantity <= 0 || !itemId) {
            preview.textContent = "Pilih barang jadi dan isi jumlah produksi. Sistem menghitung nilai bahan sesuai resep sebagai HPP per unit.";
            return;
        }

        const unitMaterialCost = getRecipeUnitCost(itemId);
        if (unitMaterialCost === null) {
            const hasRecipe = dataResep.some((item) => Number(item.id_barang) === itemId);
            preview.textContent = hasRecipe
                ? "HPP produksi belum dapat dihitung. Catat harga perolehan untuk seluruh bahan habis pakai terlebih dahulu."
                : "HPP produksi belum dapat dihitung. Tambahkan bahan habis pakai untuk barang jadi ini terlebih dahulu.";
            return;
        }

        const materialCost = unitMaterialCost * quantity;
        const unitCost = materialCost / quantity;
        preview.textContent = [
            `Biaya bahan: ${formatRupiah(materialCost)}`,
            `Total nilai produksi: ${formatRupiah(materialCost)}`,
            `Estimasi HPP per unit: ${formatRupiah(unitCost)}`
        ].join(" | ");
        return;
    }

    preview.textContent = "";
}

function getAutoTransactionDescription() {
    const type = document.getElementById("jenisTransaksi").value;
    const quantity = Number(document.getElementById("jumlahTransaksi").value);
    const picker = document.getElementById("itemTransaksi");
    const selected = picker && picker.value ? picker.value.split("-") : [];
    const itemId = selected.length === 2 ? Number(selected[1]) : 0;
    const isMaterial = selected[0] === "bahan";
    const record = isMaterial
        ? dataBahanBaku.find((item) => Number(item.id_bahan) === itemId)
        : dataBarangJadi.find((item) => Number(item.id_barang) === itemId);
    if (!type || !record || quantity <= 0) {
        return "";
    }

    const name = isMaterial ? record.nama_bahan : record.nama_barang;
    const unit = isMaterial ? record.satuan : "unit";
    const quantityText = Number.isInteger(quantity)
        ? String(quantity)
        : String(quantity).replace(".", ",");
    const itemDescription = `${quantityText} ${unit} ${name}`;
    const paymentLabels = {
        TUNAI: "tunai",
        TRANSFER: "transfer",
        QRIS: "QRIS",
        DEBIT: "kartu debit"
    };
    const payment = paymentLabels[
        document.getElementById("metodePembayaranTransaksi").value
    ];
    const descriptions = {
        masuk: `Pembelian bahan baku ${itemDescription}`,
        bahan_keluar: `Pemakaian bahan baku ${itemDescription}`,
        keluar: `Penjualan ${quantityText} ${name}${payment ? ` melalui ${payment}` : ""}`,
        produksi: `Produksi ${quantityText} ${name}`,
        saldo_awal: `Saldo awal persediaan ${itemDescription}`,
        penilaian_awal: `Penilaian stok ${itemDescription}`
    };

    return descriptions[type] || "";
}


/* =====================================================
   MEMBUAT PILIHAN BARANG TRANSAKSI
===================================================== */

function createTransactionItemSelect() {
    const existing = document.getElementById("itemTransaksi");
    const type = document.getElementById("jenisTransaksi").value;
    const includeMaterials = ["masuk", "bahan_keluar", "saldo_awal", "penilaian_awal"].includes(type);
    const includeProducts = ["keluar", "produksi", "saldo_awal", "penilaian_awal"].includes(type);
    const selection = existing.value;

    existing.innerHTML = '<option value="">-- Pilih Bahan / Produk --</option>';

    if (includeMaterials) {
        dataBahanBaku.forEach(function (item) {
            const option = document.createElement("option");
            option.value = `bahan-${item.id_bahan}`;
            option.textContent = `${item.kode_bahan} - ${item.nama_bahan} (Stok: ${item.stok} ${item.satuan})`;
            existing.add(option);
        });
    }

    if (includeProducts) {

        dataBarangJadi.forEach(
            function (item) {

                const hasProductionRecipe = dataResep.some(
                    (recipeItem) => Number(recipeItem.id_barang) === Number(item.id_barang)
                );
                const matchingRecipeProduct = !hasProductionRecipe && dataBarangJadi.find(
                    (candidate) =>
                        candidate.nama_barang.trim().toLocaleLowerCase("id-ID") ===
                            item.nama_barang.trim().toLocaleLowerCase("id-ID") &&
                        dataResep.some(
                            (recipeItem) => Number(recipeItem.id_barang) === Number(candidate.id_barang)
                        )
                );
                const recipeStatus = document.getElementById("jenisTransaksi").value === "produksi"
                    ? (hasProductionRecipe
                        ? ""
                        : matchingRecipeProduct
                            ? ` (Resep ada pada ${matchingRecipeProduct.kode_barang})`
                            : " (Resep belum dibuat)")
                    : "";
                const option = document.createElement("option");
                option.value = `barang-${item.id_barang}`;
                option.textContent = `${item.kode_barang} - ${item.nama_barang} (Stok: ${item.stok})${recipeStatus}`;
                option.disabled = document.getElementById("jenisTransaksi").value === "produksi" && !hasProductionRecipe;
                existing.add(option);

            }
        );

    }

    const selectedOption = Array.from(existing.options)
        .find((option) => option.value === selection && !option.disabled);
    if (selection && selectedOption) {
        existing.value = selection;
    }

}


/* =====================================================
   UTILITAS: ESCAPE HTML
===================================================== */

function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =====================================================
   UTILITAS: FORMAT RUPIAH
===================================================== */

function formatRupiah(value) {

    const angka = Number(value) || 0;

    return "Rp " + angka.toLocaleString("id-ID");
}


/* =====================================================
   UTILITAS: NOTIFIKASI
===================================================== */

function showNotification(message, type = "info") {

    const existing = document.querySelector(".notification");

    if (existing) {
        existing.remove();
    }

    const notif = document.createElement("div");

    notif.className = `notification ${type}`;
    notif.setAttribute("role", type === "error" || type === "warning" ? "alert" : "status");
    notif.setAttribute("aria-live", type === "error" || type === "warning" ? "assertive" : "polite");

    notif.textContent = message;

    document.body.appendChild(notif);

    setTimeout(function () {
        notif.remove();
    }, 3000);
}


/* =====================================================
   LOAD TRANSAKSI
===================================================== */

async function loadTransaksi() {

    const {
        data,
        error
    } = await supabaseClient
        .from("transaksi")
        .select(
            "*, bahan_baku(nama_bahan), barang_jadi(nama_barang)"
        )
        .order("tanggal", {
            ascending: false
        })
        .order("id_transaksi", {
            ascending: false
        });

    if (error) {

        console.error(
            "Gagal mengambil transaksi:",
            error
        );

        showNotification(
            "Gagal mengambil data transaksi.",
            "error"
        );

        return;
    }

    dataTransaksi = data || [];

    renderTransaksi();
}


/* =====================================================
   TAMPILKAN TRANSAKSI
===================================================== */

function renderTransaksi(data = dataTransaksi) {

    const tabel = document.getElementById("tabelTransaksi");

    if (!tabel) {
        return;
    }

    if (data.length === 0) {

        tabel.innerHTML = `
            <tr>
                <td colspan="10" class="empty-data">
                    Belum ada transaksi.
                </td>
            </tr>
        `;

        return;
    }

    tabel.innerHTML = "";

    data.forEach(function (item, index) {

        const jenis = (item.jenis_transaksi || "").toLowerCase();

        const statusClass = jenis === "masuk"
            ? "status-masuk"
            : (jenis === "produksi" ? "status-produksi" : "status-keluar");

        const namaBarang =
            item.bahan_baku
                ? item.bahan_baku.nama_bahan
                : (item.barang_jadi ? item.barang_jadi.nama_barang : "-");
        const typeLabels = {
            masuk: "Pembelian Bahan",
            bahan_keluar: "Bahan Keluar",
            produksi: "Produksi",
            keluar: "Penjualan",
            saldo_awal: "Saldo Awal",
            penilaian_awal: "Penilaian Saldo Awal"
        };
        const paymentLabels = {
            TUNAI: "Tunai",
            TRANSFER: "Transfer",
            QRIS: "QRIS",
            DEBIT: "Debit"
        };
        const transactionType = (item.jenis_transaksi || "").toUpperCase();
        const cashAmount = transactionType === "KELUAR"
            ? Number(item.nilai_penjualan || 0)
            : (transactionType === "MASUK"
                ? Number(item.nilai_persediaan || 0)
                : (transactionType === "PRODUKSI" ? Number(item.biaya_produksi || 0) : 0));
        const inventoryValue = ["KELUAR", "PRODUKSI", "BAHAN_KELUAR", "SALDO_AWAL", "PENILAIAN_AWAL"]
            .includes(transactionType)
            ? Number(item.nilai_persediaan || 0)
            : null;
        const grossProfit = transactionType === "KELUAR" && cashAmount > 0 && inventoryValue > 0
            ? cashAmount - inventoryValue
            : null;
        const amountText = (amount) => amount > 0 ? formatRupiah(amount) : "-";

        tabel.innerHTML += `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHTML(item.tanggal)}</td>
                <td><span class="${statusClass}">${escapeHTML(typeLabels[jenis] || item.jenis_transaksi)}</span></td>
                <td>${escapeHTML(namaBarang)}</td>
                <td>${escapeHTML(item.jumlah)}</td>
                <td>${amountText(cashAmount)}</td>
                <td>${inventoryValue === null
                    ? "-"
                    : (inventoryValue > 0 ? formatRupiah(inventoryValue) : "Belum dihitung")}</td>
                <td>${grossProfit === null ? "-" : formatRupiah(grossProfit)}</td>
                <td>${escapeHTML(paymentLabels[item.metode_pembayaran] || "-")}</td>
                <td>${escapeHTML(item.keterangan || "-")}</td>
            </tr>
        `;

    });

}


/* =====================================================
   LOAD PERSEDIAAN
===================================================== */

async function loadPersediaan() {

    try {

        // Fetch fresh data bahan baku dari Supabase
        const {
            data: bahanData,
            error: bahanError
        } = await supabaseClient
            .from("bahan_baku")
            .select("*")
            .eq("aktif", true)
            .order("id_bahan", {
                ascending: true
            });

        if (bahanError) {
            throw bahanError;
        }


        // Fetch fresh data barang jadi dari Supabase
        const {
            data: barangData,
            error: barangError
        } = await supabaseClient
            .from("barang_jadi")
            .select("*")
            .eq("aktif", true)
            .order("id_barang", {
                ascending: true
            });

        if (barangError) {
            throw barangError;
        }


        // Update cache global juga biar konsisten
        // dengan halaman Bahan Baku & Barang Jadi
        dataBahanBaku = bahanData || [];
        dataBarangJadi = barangData || [];


        // Baru render
        renderPersediaan();

    } catch (error) {

        console.error(
            "Gagal refresh persediaan:",
            error
        );

        showNotification(
            "Gagal refresh data persediaan.",
            "error"
        );

    }

}


/* =====================================================
   TAMPILKAN PERSEDIAAN
===================================================== */

function renderPersediaan() {

    const tabel = document.getElementById("tabelPersediaan");

    if (!tabel) {
        return;
    }

    const gabungan = [
        ...dataBahanBaku.map(function (item) {
            return {
                nama: item.nama_bahan,
                jenis: "Bahan Baku",
                stok: item.stok,
                stokMinimum: getMaterialMinimumStock(),
                satuan: item.satuan,
                unitCost: item.harga_pokok_rata_rata
            };
        }),
        ...dataBarangJadi.map(function (item) {
            return {
                nama: item.nama_barang,
                jenis: "Barang Jadi",
                stok: item.stok,
                stokMinimum: 1,
                satuan: "pcs",
                unitCost: item.harga_pokok_rata_rata
            };
        })
    ];

    if (gabungan.length === 0) {

        tabel.innerHTML = `
            <tr>
                <td colspan="6" class="empty-data">
                    Belum ada data persediaan.
                </td>
            </tr>
        `;

        return;
    }

    tabel.innerHTML = "";

    gabungan.forEach(function (item, index) {

        let stokClass = "stok-aman";

        if (Number(item.stok) === 0) {
            stokClass = "stok-habis";
        } else if (item.stokMinimum > 0 && Number(item.stok) <= item.stokMinimum) {
            stokClass = "stok-sedikit";
        }

        tabel.innerHTML += `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHTML(item.nama)}</td>
                <td>${escapeHTML(item.jenis)}</td>
                <td class="${stokClass}">${item.stok}</td>
                <td>${escapeHTML(item.satuan)}</td>
                <td>${formatRupiah(Number(item.stok) * Number(item.unitCost || 0))}</td>
            </tr>
        `;

    });

}


/* =====================================================
   SIMPAN TRANSAKSI
===================================================== */

async function saveTransaksi(event) {

    event.preventDefault();

    const tanggal = document.getElementById("tanggalTransaksi").value;
    const jenisTransaksi = document.getElementById("jenisTransaksi").value;
    const itemTransaksi = document.getElementById("itemTransaksi");
    const jumlah = Number(document.getElementById("jumlahTransaksi").value);
    const keterangan = getAutoTransactionDescription();
    const hargaPerolehan = Number(document.getElementById("hargaPerolehanTransaksi").value);
    const hargaJual = Number(document.getElementById("hargaJualTransaksi").value);
    const metodePembayaran = document.getElementById("metodePembayaranTransaksi").value;

    if (!tanggal || !jenisTransaksi || !itemTransaksi || !itemTransaksi.value) {

        showNotification(
            "Mohon lengkapi semua data transaksi.",
            "warning"
        );

        return;
    }

    if ((!Number.isFinite(jumlah) || jumlah <= 0) && jenisTransaksi !== "penilaian_awal") {

        showNotification(
            "Jumlah transaksi harus lebih dari 0.",
            "warning"
        );

        return;
    }

    const [tipeItem, idItemStr] = itemTransaksi.value.split("-");
    const idItem = Number(idItemStr);

    if (["masuk", "bahan_keluar"].includes(jenisTransaksi) && tipeItem !== "bahan") {
        showNotification(
            "Pilih bahan baku untuk transaksi pembelian atau pemakaian.",
            "warning"
        );

        return;
    }

    if (["keluar", "produksi"].includes(jenisTransaksi) && tipeItem !== "barang") {
        showNotification(
            "Pilih barang jadi untuk transaksi produksi atau penjualan.",
            "warning"
        );

        return;
    }

    const record = (tipeItem === "bahan" ? dataBahanBaku : dataBarangJadi)
        .find((item) => Number(item[tipeItem === "bahan" ? "id_bahan" : "id_barang"]) === idItem);
    const jumlahTransaksi = jenisTransaksi === "penilaian_awal"
        ? Number(record ? record.stok : 0)
        : jumlah;
    if (tipeItem === "barang" && !Number.isInteger(jumlahTransaksi)) {
        showNotification("Jumlah barang jadi harus berupa bilangan bulat.", "warning");
        return;
    }

    if (jenisTransaksi === "penilaian_awal" && jumlahTransaksi <= 0) {
        showNotification("Pilih barang yang memiliki stok untuk menilai saldo awal.", "warning");
        return;
    }

    if (
        ["masuk", "saldo_awal", "penilaian_awal"].includes(jenisTransaksi) &&
        (!Number.isFinite(hargaPerolehan) || hargaPerolehan <= 0)
    ) {
        showNotification("Masukkan harga perolehan per satuan lebih dari 0.", "warning");
        return;
    }

    if (jenisTransaksi === "keluar" && (!Number.isFinite(hargaJual) || hargaJual <= 0)) {
        showNotification("Masukkan harga jual per unit lebih dari 0.", "warning");
        return;
    }

    if (["masuk", "keluar"].includes(jenisTransaksi) && !metodePembayaran) {
        showNotification("Pilih metode pembayaran.", "warning");
        return;
    }

    if (jenisTransaksi === "produksi") {
        const resepProduk = dataResep.filter((item) => Number(item.id_barang) === idItem);

        if (resepProduk.length === 0) {
            showNotification("Tambahkan bahan habis pakai untuk produk ini terlebih dahulu.", "warning");
            return;
        }

        if (resepProduk.some((item) => item.bahan_baku && item.bahan_baku.aktif === false)) {
            showNotification("Bahan habis pakai produk ini sudah diarsipkan. Perbarui daftarnya terlebih dahulu.", "warning");
            return;
        }
    }

    const payload = {
        tanggal: tanggal,
        jenis_transaksi: jenisTransaksi.toUpperCase(),
        keterangan: keterangan || null,
        jumlah: jumlahTransaksi,
        id_bahan: tipeItem === "bahan" ? idItem : null,
        id_barang: tipeItem === "barang" ? idItem : null,
        harga_perolehan_satuan: ["masuk", "saldo_awal", "penilaian_awal"].includes(jenisTransaksi)
            ? hargaPerolehan
            : null,
        harga_jual_satuan: jenisTransaksi === "keluar" ? hargaJual : null,
        metode_pembayaran: metodePembayaran || null
    };

    try {

        const { error } = await supabaseClient
            .from("transaksi")
            .insert([payload]);

        if (error) {
            throw error;
        }

        const messages = {
            masuk: "Pembelian bahan tercatat; stok dan jurnal pembelian diperbarui.",
            bahan_keluar: "Pemakaian bahan tercatat dan nilai persediaan diperbarui.",
            produksi: "Produksi tercatat; bahan dikurangi, biaya dipindahkan ke barang jadi, dan jurnal dibuat.",
            keluar: "Penjualan tercatat; pembayaran, pendapatan, HPP, stok, dan jurnal diperbarui.",
            saldo_awal: "Saldo awal ditambahkan dan jurnal modal awal dibuat.",
            penilaian_awal: "Nilai stok lama disesuaikan dan jurnal saldo awal dibuat."
        };
        showNotification(messages[jenisTransaksi], "success");

        document.getElementById("transaksiForm").reset();
        document.getElementById("transaksiForm").dataset.dirty = "false";

        const tanggalInput = document.getElementById("tanggalTransaksi");
        tanggalInput.value = tanggal;
        createTransactionItemSelect();
        syncTransactionFields();
        document.getElementById("nilaiTransaksiPreview").textContent = "";

        await loadTransaksi();
        await loadBahanBaku();
        await loadBarangJadi();
        await loadResep();
        await loadPersediaan();
        await loadDashboard();
        if (document.getElementById("laporan").classList.contains("active-page")) {
            await loadAccountingReport();
        }

    } catch (error) {

        console.error(error);

        const message = [error.message, error.details, error.hint].filter(Boolean).join(" ");
        showNotification(message || "Gagal menyimpan transaksi. Periksa nilai transaksi dan ketersediaan stok.", "error");

    }

}



/* =====================================================
   AUTO REFRESH OTOMATIS (POLLING)
   =====================================================
   Fungsi ini otomatis memuat ulang data dari Supabase
   setiap 5 detik, tanpa user perlu klik tombol Refresh.
   
   Yang di-refresh hanya halaman yang sedang aktif,
   jadi tidak boros request ke Supabase.
===================================================== */

let autoRefreshTimer = null;

async function autoRefreshActivePage() {

    if (!activeUserId) {
        return;
    }

    // Jangan refresh kalau tab browser tidak aktif
    // (hemat kuota & resource)
    if (document.hidden) {
        return;
    }


    // Jangan refresh kalau user sedang mengisi form
    // (biar input yang sedang diketik tidak hilang)
    const formBahanBaku = document.getElementById("formBahanBaku");
    const formBarangJadi = document.getElementById("formBarangJadi");
    const resepForm = document.getElementById("resepForm");
    const transaksiForm = document.getElementById("transaksiForm");

    const sedangIsiForm =
        (formBahanBaku && !formBahanBaku.classList.contains("hidden")) ||
        (formBarangJadi && !formBarangJadi.classList.contains("hidden")) ||
        (resepForm && resepForm.dataset.dirty === "true") ||
        (transaksiForm && transaksiForm.dataset.dirty === "true");

    if (sedangIsiForm) {
        return;
    }


    // Cari halaman yang sedang aktif
    const halamanAktif = document.querySelector(".page.active-page");

    if (!halamanAktif) {
        return;
    }


    try {

        // Refresh sesuai halaman yang sedang dibuka
        switch (halamanAktif.id) {

            case "dashboard":
                await loadDashboard();
                break;

            case "bahan-baku":
                await loadBahanBaku();
                break;

            case "barang-jadi":
                await loadBarangJadi();
                await loadResep();
                break;

            case "bahan-habis-pakai":
                await loadBahanBaku();
                await loadBarangJadi();
                await loadResep();
                break;

            case "transaksi":
                await loadBahanBaku();
                await loadBarangJadi();
                await loadResep();
                await loadTransaksi();
                break;

            case "persediaan":
                await loadPersediaan();
                break;

            case "laporan":
                await loadAccountingReport();
                break;

            default:
                break;
        }

    } catch (error) {

        // Kalau gagal refresh, jangan spam notifikasi.
        // Cukup tampilkan di console saja.
        console.warn("Auto refresh gagal:", error);

    }

}


/* =====================================================
   JALANKAN AUTO REFRESH
   =====================================================
   Setiap 5 detik (5000 ms).
   Kalau mau lebih cepat/g lambat, ubah angka 5000:
   - 3000  = 3 detik  (lebih sering, agak boros)
   - 5000  = 5 detik  (rekomendasi)
   - 10000 = 10 detik (lebih hemat)
===================================================== */

document.addEventListener("DOMContentLoaded", function () {

    // Bersihkan timer kalau ada (hindari duplikat)
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
    }

    autoRefreshTimer = setInterval(
        autoRefreshActivePage,
        5000
    );

    console.log("✅ Auto refresh aktif (tiap 5 detik)");

});