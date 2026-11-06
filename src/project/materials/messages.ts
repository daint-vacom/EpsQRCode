export const materialMessagesVi: Record<string, string> = {
  'project.materials.select.placeholder': 'Chọn vật tư',
  'project.materials.select.search': 'Tìm theo mã, tên hoặc số sê-ri',
  'project.materials.select.loadError': 'Không tải được danh sách vật tư',
  'project.materials.page.title': 'Quản lý vật tư',
  'project.materials.page.detailTitle': 'Chi tiết vật tư',
  'project.materials.page.createTitle': 'Thêm vật tư',
  'project.materials.page.editTitle': 'Sửa thông tin vật tư',
  'project.materials.page.description':
    'Theo dõi thiết bị, chủ sở hữu và tình trạng sử dụng.',
  'project.materials.actions.create': 'Thêm vật tư',
  'project.materials.actions.view': 'Xem chi tiết',
  'project.materials.actions.viewShort': 'Xem',
  'project.materials.actions.more': 'Thao tác khác',
  'project.materials.actions.edit': 'Sửa thông tin',
  'project.materials.actions.editMaterial': 'Sửa thông tin vật tư',
  'project.materials.actions.handover': 'Bàn giao vật tư',
  'project.materials.actions.delete': 'Xóa vật tư',
  'project.materials.bulk.selectedCount': 'Đã chọn {count} vật tư',
  'project.materials.bulk.chooseAction': 'Chọn thao tác',
  'project.materials.bulk.apply': 'Áp dụng',
  'project.materials.selection.selectedCount': 'Đã chọn {count} vật tư',
  'project.materials.selection.title': 'Chọn vật tư',
  'project.materials.selection.confirm': 'Xác nhận',
  'project.materials.bulk.handover': 'Bàn giao vật tư',
  'project.materials.bulk.handover.dialog.title':
    'Kiểm tra trước khi lập phiếu bàn giao',
  'project.materials.bulk.handover.dialog.close': 'Đóng',
  'project.materials.bulk.handover.check.sameOwner':
    'Tất cả vật tư cùng một đối tượng sở hữu',
  'project.materials.bulk.handover.check.ready':
    'Tất cả vật tư sẵn sàng để bàn giao',
  'project.materials.bulk.handover.check.passed': 'Đạt',
  'project.materials.bulk.handover.check.failed': 'Cần kiểm tra',
  'project.materials.bulk.handover.errors.mixedOwners':
    'Các vật tư đã chọn không cùng một đối tượng sở hữu.',
  'project.materials.bulk.handover.errors.missingOwner':
    'Không xác định được chủ sở hữu của vật tư {code}.',
  'project.materials.bulk.handover.errors.notAvailable':
    'Vật tư {code} chưa ở trạng thái sẵn sàng để bàn giao.',
  'project.materials.bulk.handover.errors.reserved':
    'Vật tư {code} đang được giữ trong một phiếu bàn giao ({status}).',
  'project.materials.bulk.printQr': 'In nhãn QR',
  'project.materials.bulk.delete': 'Xóa vật tư',
  'project.materials.bulk.deleteDescription':
    'Bạn có chắc muốn xóa {count} vật tư đã chọn? Hành động này không thể hoàn tác.',
  'project.materials.bulk.deleteConfirm': 'Xóa {count} vật tư',
  'project.materials.actions.save': 'Lưu vật tư',
  'project.materials.actions.back': 'Quay lại danh sách vật tư',
  'project.materials.actions.retry': 'Thử tải lại',
  'project.materials.actions.printLabel': 'In nhãn',
  'project.materials.actions.cancel': 'Hủy',
  'project.materials.actions.saving': 'Đang lưu',
  'project.materials.actions.customize': 'Chỉnh sửa giá trị',
  'project.materials.actions.useModelValue': 'Dùng giá trị theo mẫu',
  'project.materials.actions.resetImage': 'Dùng ảnh theo mẫu',
  'project.materials.actions.printQr': 'In nhãn QR',
  'project.materials.actions.expandImage': 'Phóng to ảnh vật tư',
  'project.materials.actions.expandQrCode': 'Phóng to mã QR vật tư {code}',
  'project.materials.actions.viewImage': 'Xem ảnh',
  'project.materials.actions.openQrLink': 'Mở liên kết chi tiết',
  'project.materials.actions.manageCustodians': 'Quản lý đơn vị EPS',
  'project.materials.actions.openReservation': 'Mở phiếu đang giữ vật tư',
  'project.materials.actions.syncing': 'Đang đồng bộ',
  'project.materials.actions.syncModel': 'Đồng bộ từ mẫu',
  'project.materials.actions.confirmSync': 'Xác nhận đồng bộ',
  'project.materials.actions.createHandover': 'Lập phiếu bàn giao',
  'project.materials.actions.createLoan': 'Cho mượn',
  'project.materials.actions.return': 'Nhận trả',
  'project.materials.fields.code': 'Mã vật tư',
  'project.materials.fields.identity': 'Vật tư',
  'project.materials.fields.qrCode': 'QR Code',
  'project.materials.fields.holder': 'Đơn vị đang giữ',
  'project.materials.fields.enable': 'Bật sử dụng vật tư {name}',
  'project.materials.fields.disable': 'Tắt sử dụng vật tư {name}',
  'project.materials.fields.model': 'Mẫu vật tư',
  'project.materials.fields.name': 'Tên vật tư',
  'project.materials.fields.description': 'Mô tả',
  'project.materials.fields.image': 'Ảnh vật tư',
  'project.materials.fields.imagePreview': 'Xem trước ảnh vật tư',
  'project.materials.fields.serialNumber': 'Số sê-ri',
  'project.materials.fields.owner': 'Chủ sở hữu',
  'project.materials.fields.managedBy': 'Đơn vị quản lý',
  'project.materials.fields.representative': 'Người phụ trách',
  'project.materials.fields.epsUnit': 'Đơn vị EPS',
  'project.materials.fields.initialOwner': 'Chủ sở hữu ban đầu',
  'project.materials.sections.owner': 'Đơn vị sở hữu',
  'project.materials.fields.borrower': 'Đơn vị/cá nhân đang mượn',
  'project.materials.fields.condition': 'Tình trạng',
  'project.materials.fields.note': 'Ghi chú',
  'project.materials.fields.specifications': 'Thông số kỹ thuật',
  'project.materials.fields.specificationName': 'Thông số',
  'project.materials.fields.specificationValue': 'Giá trị',
  'project.materials.fields.specificationEdit': 'Sửa',
  'project.materials.fields.specificationVisible': 'Hiển thị',
  'project.materials.fields.specificationPublicLabel':
    'Cho phép hiển thị thông số {name} khi xem công khai',
  'project.materials.fields.specificationEditLabel':
    'Cho phép sửa thông số {name}',
  'project.materials.fields.issuedDate': 'Ngày cấp',
  'project.materials.fields.status': 'Trạng thái sử dụng',
  'project.materials.fields.requiresInspection': 'Cần kiểm tra',
  'project.materials.fields.group': 'Nhóm vật tư',
  'project.materials.fields.createdAt': 'Ngày tạo',
  'project.materials.fields.updatedAt': 'Cập nhật gần nhất',
  'project.materials.filters.search': 'Tìm mã, tên, mẫu hoặc số sê-ri',
  'project.materials.filters.model': 'Lọc theo mẫu',
  'project.materials.filters.owner': 'Lọc theo chủ sở hữu',
  'project.materials.filters.borrower': 'Lọc theo bên đang mượn',
  'project.materials.filters.group': 'Lọc theo nhóm',
  'project.materials.filters.status': 'Lọc theo trạng thái',
  'project.materials.filters.statusPlaceholder': 'Tất cả trạng thái',
  'project.materials.filters.condition': 'Lọc theo tình trạng',
  'project.materials.empty.list': 'Chưa có vật tư nào.',
  'project.materials.empty.search': 'Không tìm thấy vật tư phù hợp.',
  'project.materials.errors.loadTitle': 'Không tải được danh sách vật tư',
  'project.materials.errors.loadFiltersTitle':
    'Không tải được bộ lọc danh sách',
  'project.materials.errors.loadHandoversTitle':
    'Không tải được phiếu bàn giao liên quan',
  'project.materials.errors.loadHistoryTitle': 'Không tải được lịch sử vật tư',
  'project.materials.errors.loadSyncTitle':
    'Không tải được thông tin đối chiếu mẫu',
  'project.materials.errors.loadCustodiansTitle':
    'Không tải được danh sách chủ thể',
  'project.materials.errors.authorizationTitle': 'Không có quyền truy cập',
  'project.materials.errors.notFoundTitle': 'Không tìm thấy vật tư',
  'project.materials.errors.loadDetailTitle': 'Không tải được thông tin vật tư',
  'project.materials.errors.authorization':
    'Bạn không có quyền xem thông tin này.',
  'project.materials.errors.mixedStatuses':
    'Vui lòng chỉ chọn vật tư cùng trạng thái để lập một phiếu bàn giao.',
  'project.materials.errors.notFound': 'Vật tư không tồn tại hoặc đã bị xóa.',
  'project.materials.dialogs.deleteTitle': 'Xác nhận xóa vật tư',
  'project.materials.dialogs.deleteConfirm': 'Xóa vật tư',
  'project.materials.dialogs.deleteDescription':
    'Bạn có chắc muốn xóa “{name}”? Hành động này không thể hoàn tác.',
  'project.materials.tabs.overview': 'Tổng quan',
  'project.materials.tabs.general': 'Thông tin chung',
  'project.materials.tabs.handoverHistory': 'Lịch sử bàn giao',
  'project.materials.tabs.inventoryHistory': 'Lịch sử kiểm kê',
  'project.materials.tabs.safety': 'Quản lý an toàn',
  'project.materials.tabs.safetyChecklist': 'Kiểm định an toàn',
  'project.materials.safetyInspection.checklist.empty':
    'Chưa có nhóm nội dung kiểm định.',
  'project.materials.safetyInspection.checklist.group':
    'Nhóm nội dung kiểm định',
  'project.materials.safetyInspection.checklist.groupName':
    'Tên nhóm nội dung kiểm định {group}',
  'project.materials.safetyInspection.checklist.groupNamePlaceholder':
    'Nhập tên nhóm nội dung kiểm định',
  'project.materials.safetyInspection.checklist.groupNameRequired':
    'Vui lòng nhập tên nhóm nội dung kiểm định.',
  'project.materials.safetyInspection.checklist.criterion':
    'Nội dung kiểm định',
  'project.materials.safetyInspection.checklist.criterionNumber':
    'Nội dung kiểm định {group}.{criterion}',
  'project.materials.safetyInspection.checklist.criterionPlaceholder':
    'Nhập nội dung kiểm định',
  'project.materials.safetyInspection.checklist.criterionRequired':
    'Vui lòng nhập nội dung kiểm định.',
  'project.materials.safetyInspection.checklist.removeGroup':
    'Xóa nhóm nội dung kiểm định {group}',
  'project.materials.safetyInspection.checklist.removeCriterion':
    'Xóa nội dung {criterion} trong nhóm {group}',
  'project.materials.safetyInspection.checklist.reorderGroup':
    'Kéo để sắp xếp nhóm {group}',
  'project.materials.safetyInspection.checklist.reorderCriterion':
    'Kéo để sắp xếp nội dung {criterion} trong nhóm {group}',
  'project.materials.safetyInspection.checklist.collapseGroup':
    'Thu gọn nhóm {group}',
  'project.materials.safetyInspection.checklist.expandGroup':
    'Mở rộng nhóm {group}',
  'project.materials.safetyInspection.checklist.criteriaCount':
    '{count} nội dung',
  'project.materials.safetyInspection.checklist.count':
    '{groups} nhóm · {criteria} nội dung',
  'project.materials.safetyInspection.checklist.rowNumber': 'STT',
  'project.materials.safetyInspection.checklist.addCriterion': 'Thêm nội dung',
  'project.materials.safetyInspection.checklist.addGroup':
    'Thêm nhóm nội dung kiểm định',
  'project.materials.safetyInspection.checklist.inheritedTitle':
    'Checklist được kế thừa',
  'project.materials.safetyInspection.page.createTitle':
    'Lập phiếu kiểm định an toàn',
  'project.materials.safetyInspection.page.detailTitle':
    'Chi tiết phiếu kiểm định',
  'project.materials.safetyInspection.page.createDescription':
    'Ghi nhận kết quả kiểm định thực tế của vật tư.',
  'project.materials.safetyInspection.toasts.created':
    'Đã lưu phiếu kiểm định.',
  'project.materials.safetyInspection.sections.information':
    'Thông tin kiểm định',
  'project.materials.safetyInspection.sections.checklist':
    'Checklist kiểm định',
  'project.materials.safetyInspection.fields.inspectedAt':
    'Thời gian kiểm định',
  'project.materials.safetyInspection.fields.inspector': 'Người kiểm định',
  'project.materials.safetyInspection.fields.note': 'Ghi chú tổng',
  'project.materials.safetyInspection.fields.result': 'Kết quả kiểm định',
  'project.materials.safetyInspection.fields.criteriaResult': 'Đạt',
  'project.materials.safetyInspection.fields.criteriaNote':
    'Ghi chú nội dung kiểm định',
  'project.materials.safetyInspection.results.passed': 'Đạt',
  'project.materials.safetyInspection.results.failed': 'Không đạt',
  'project.materials.safetyInspection.actions.create': 'Lập phiếu kiểm định',
  'project.materials.safetyInspection.actions.save': 'Lưu phiếu',
  'project.materials.safetyInspection.actions.back': 'Quay lại chi tiết vật tư',
  'project.materials.safetyInspection.attachments.download': 'Tải tệp',
  'project.materials.safetyInspection.attachments.unavailable':
    'Không thể tạo liên kết tải tệp.',
  'project.materials.safetyInspection.history.title': 'Lịch sử kiểm định',
  'project.materials.safetyInspection.history.description':
    'Các phiếu kiểm định an toàn đã lập cho vật tư này.',
  'project.materials.safetyInspection.history.empty':
    'Vật tư chưa có phiếu kiểm định an toàn.',
  'project.materials.safetyInspection.history.loadTitle':
    'Không tải được lịch sử kiểm định',
  'project.materials.safetyInspection.history.open':
    'Xem phiếu kiểm định ngày {date}',
  'project.materials.safetyInspection.history.criteriaCount':
    '{count} nội dung',
  'project.materials.safetyInspection.errors.noChecklist':
    'Mẫu vật tư chưa có checklist kiểm định. Hãy bổ sung checklist trước khi lập phiếu.',
  'project.materials.safetyInspection.errors.notRequired':
    'Mẫu vật tư này chưa được bật kiểm định an toàn.',
  'project.materials.safetyInspection.errors.notFound':
    'Phiếu kiểm định không tồn tại hoặc đã bị xóa.',
  'project.materials.safetyInspection.errors.fileTooLarge':
    'Tệp "{fileName}" vượt quá giới hạn 20 MB.',
  'project.materials.safetyInspection.validation.inspector':
    'Vui lòng nhập người kiểm định.',
  'project.materials.safetyInspection.validation.result':
    'Vui lòng chọn kết quả kiểm định.',
  'project.materials.tabs.repairs': 'Lịch sử sửa chữa',
  'project.materials.tabs.feedback': 'Phản ánh',
  'project.materials.tabs.specifications': 'Thông số kỹ thuật',
  'project.materials.tabs.handovers': 'Bàn giao',
  'project.materials.tabs.history': 'Lịch sử',
  'project.materials.tabs.related': 'Bàn giao liên quan',
  'project.materials.fields.customInfo': 'Thông tin bổ sung',
  'project.materials.status.available': 'Sẵn sàng',
  'project.materials.status.loaned': 'Đang mượn',
  'project.materials.condition.good': 'Còn tốt',
  'project.materials.condition.damaged': 'Hỏng hóc',
  'project.materials.sync.title': 'Xem trước đồng bộ mẫu',
  'project.materials.sync.modelInformation': 'Thông tin mẫu',
  'project.materials.sync.specification': 'Thông số: {name}',
  'project.materials.sync.groupChanged': 'Nhóm vật tư được thay đổi',
  'project.materials.sync.description':
    'Thông tin mẫu đã lưu của vật tư sẽ được cập nhật. Tên, mô tả, ảnh và thông số đã chọn của vật tư sẽ được giữ nguyên.',
  'project.materials.sync.empty': 'Mẫu hiện không có thay đổi mới.',
  'project.materials.sync.preserved': 'Thông tin vật tư được giữ lại',
  'project.materials.sections.identity': 'Thông tin nhận diện',
  'project.materials.sections.initialState': 'Thông tin khởi tạo',
  'project.materials.sections.modelSnapshot': 'Thông tin mẫu đã lưu',
  'project.materials.sections.specifications': 'Thông số kỹ thuật',
  'project.materials.sections.currentState': 'Tình trạng hiện tại',
  'project.materials.sections.materialInfo': 'Thông tin vật tư',
  'project.materials.sections.qr': 'Mã QR vật tư',
  'project.materials.sections.printedQrLabel': 'Nhãn QR vật tư đã in',
  'project.materials.form.chooseModelHint':
    'Chọn mẫu vật tư để xem thông tin được lưu khi tạo.',
  'project.materials.form.publicDisplay.title': 'Thông tin hiển thị công khai',
  'project.materials.form.publicDisplay.basicInfo': 'Cho phép xem vật tư',
  'project.materials.form.publicDisplay.specifications':
    'Cho phép xem thông số kỹ thuật',
  'project.materials.publicDetail.title': 'Thông tin vật tư',
  'project.materials.publicDetail.basicInfo': 'Thông tin cơ bản',
  'project.materials.publicDetail.specifications': 'Thông số kỹ thuật',
  'project.materials.publicDetail.emptySpecifications':
    'Vật tư chưa có thông số kỹ thuật.',
  'project.materials.publicDetail.notShared': 'Thông tin không được công khai',
  'project.materials.publicDetail.unavailable': 'Không thể xem vật tư',
  'project.materials.publicDetail.unavailableDescription':
    'Vật tư không được cho phép hiển thị công khai hoặc đã ngừng hoạt động.',
  'project.materials.publicDetail.errors.loadTitle':
    'Không tải được thông tin vật tư',
  'project.materials.form.inheritedSpecifications':
    'Thông số kế thừa ({count})',
  'project.materials.form.chooseSpecificationValue': 'Chọn giá trị gợi ý',
  'project.materials.form.chooseSpecificationValues':
    'Chọn một hoặc nhiều giá trị',
  'project.materials.form.searchSpecificationValues': 'Tìm giá trị',
  'project.materials.form.noRepresentedOwner':
    'Tài khoản hiện chưa được đại diện chủ thể nào. Hãy thiết lập người đại diện trước khi tạo vật tư.',
  'project.materials.gallery.title': 'Ảnh vật tư',
  'project.materials.gallery.emptyTitle': 'Thêm ảnh vật tư',
  'project.materials.gallery.dropInstruction': 'Kéo thả ảnh vào đây hoặc',
  'project.materials.gallery.dropActive': 'Thả ảnh để thêm vào vật tư',
  'project.materials.gallery.chooseImages': 'Chọn ảnh',
  'project.materials.gallery.count': '{count} ảnh',
  'project.materials.gallery.viewImage': 'Xem ảnh {index}',
  'project.materials.gallery.add': 'Thêm ảnh',
  'project.materials.gallery.cover': 'Ảnh đại diện',
  'project.materials.gallery.setCover': 'Đặt làm ảnh đại diện',
  'project.materials.gallery.remove': 'Xóa ảnh',
  'project.materials.gallery.limit': 'Mỗi vật tư có thể có tối đa 10 ảnh.',
  'project.materials.gallery.invalidType':
    'Vui lòng chọn ảnh JPG, PNG hoặc WEBP.',
  'project.materials.gallery.tooLarge': 'Mỗi ảnh không được vượt quá 5MB.',
  'project.materials.gallery.coverRequired': 'Vui lòng chọn một ảnh đại diện.',
  'project.materials.toasts.created': 'Đã thêm vật tư.',
  'project.materials.toasts.updated': 'Đã cập nhật thông tin vật tư.',
  'project.materials.toasts.activated': 'Đã bật sử dụng vật tư.',
  'project.materials.toasts.deactivated': 'Đã tắt sử dụng vật tư.',
  'project.materials.toasts.deleted': 'Đã xóa vật tư “{name}”.',
  'project.materials.toasts.deletedMultiple': 'Đã xóa {count} vật tư.',
  'project.materials.list.recordCountLabel': 'vật tư',
  'project.materials.empty.handovers': 'Chưa có phiếu bàn giao liên quan.',
  'project.materials.empty.specifications': 'Mẫu vật tư chưa có thông số.',
  'project.materials.empty.history': 'Chưa có lịch sử phát sinh.',
  'project.materials.toasts.synced': 'Đã cập nhật thông tin từ mẫu.',
  'project.materials.history.created': 'Tạo vật tư',
  'project.materials.history.updated': 'Cập nhật thông tin vật tư',
  'project.materials.history.model_synced': 'Cập nhật thông tin từ mẫu',
  'project.materials.history.handover': 'Hoàn tất bàn giao',
  'project.materials.handoverType.transfer': 'Chuyển sở hữu',
  'project.materials.handoverType.loan': 'Cho mượn',
  'project.materials.handoverType.return': 'Trả lại',
  'project.materials.handoverStatus.draft': 'Bản nháp',
  'project.materials.handoverStatus.pending': 'Chờ xác nhận',
  'project.materials.handoverStatus.completed': 'Đã hoàn tất',
  'project.materials.handoverStatus.rejected': 'Đã từ chối',
  'project.materials.handoverStatus.cancelled': 'Đã hủy',
  'project.materials.states.loading': 'Đang tải',
  'project.materials.states.error': 'Đã xảy ra lỗi',
  'project.materials.states.loadFailed': 'Không tải được thông tin',
  'project.materials.states.lastPrintedLabel': 'Nhãn đã in lần cuối',
  'project.materials.states.notPrintedLabel': 'Vật tư chưa in tem nhãn',
  'project.materials.states.reserved':
    'Vật tư đang nằm trong phiếu bàn giao chưa hoàn tất.',
  'project.materials.history.actor': 'Người thực hiện',
  'project.materials.history.changed': 'Đã thay đổi',
  'project.materials.history.unknownActor': 'Tài khoản đã thực hiện',
  'project.materials.history.unknownParty': 'Chủ thể',
};

export const materialMessagesEn: Record<string, string> = {
  'project.materials.select.placeholder': 'Select a material',
  'project.materials.select.search': 'Search by code, name, or serial number',
  'project.materials.select.loadError': 'Could not load materials',
  'project.materials.page.title': 'Materials',
  'project.materials.page.detailTitle': 'Material details',
  'project.materials.page.createTitle': 'Add material',
  'project.materials.page.editTitle': 'Edit material information',
  'project.materials.page.description':
    'Track equipment, ownership, and current use.',
  'project.materials.actions.create': 'Add material',
  'project.materials.actions.view': 'View details',
  'project.materials.actions.viewShort': 'View',
  'project.materials.actions.more': 'More actions',
  'project.materials.actions.edit': 'Edit information',
  'project.materials.actions.editMaterial': 'Edit material information',
  'project.materials.actions.handover': 'Hand over material',
  'project.materials.actions.delete': 'Delete material',
  'project.materials.bulk.selectedCount': '{count} materials selected',
  'project.materials.bulk.chooseAction': 'Choose an action',
  'project.materials.bulk.apply': 'Apply',
  'project.materials.selection.selectedCount': '{count} materials selected',
  'project.materials.selection.title': 'Select materials',
  'project.materials.selection.confirm': 'Confirm',
  'project.materials.bulk.handover': 'Hand over materials',
  'project.materials.bulk.handover.dialog.title':
    'Check before creating a handover',
  'project.materials.bulk.handover.dialog.close': 'Close',
  'project.materials.bulk.handover.check.sameOwner':
    'All materials have the same owner',
  'project.materials.bulk.handover.check.ready':
    'All materials are ready for handover',
  'project.materials.bulk.handover.check.passed': 'Passed',
  'project.materials.bulk.handover.check.failed': 'Needs attention',
  'project.materials.bulk.handover.errors.mixedOwners':
    'The selected materials do not have the same owner.',
  'project.materials.bulk.handover.errors.missingOwner':
    'The owner of material {code} could not be identified.',
  'project.materials.bulk.handover.errors.notAvailable':
    'Material {code} is not in a ready state for handover.',
  'project.materials.bulk.handover.errors.reserved':
    'Material {code} is reserved by a handover ({status}).',
  'project.materials.bulk.printQr': 'Print QR labels',
  'project.materials.bulk.delete': 'Delete materials',
  'project.materials.bulk.deleteDescription':
    'Are you sure you want to delete the {count} selected materials? This cannot be undone.',
  'project.materials.bulk.deleteConfirm': 'Delete {count} materials',
  'project.materials.actions.save': 'Save material',
  'project.materials.actions.back': 'Back to materials',
  'project.materials.actions.retry': 'Retry',
  'project.materials.actions.printLabel': 'Print label',
  'project.materials.actions.cancel': 'Cancel',
  'project.materials.actions.saving': 'Saving',
  'project.materials.actions.customize': 'Edit value',
  'project.materials.actions.useModelValue': 'Use model value',
  'project.materials.actions.resetImage': 'Use model image',
  'project.materials.actions.manageCustodians': 'Manage EPS organizations',
  'project.materials.actions.openReservation':
    'Open handover holding this material',
  'project.materials.actions.syncing': 'Syncing',
  'project.materials.actions.syncModel': 'Sync from model',
  'project.materials.actions.confirmSync': 'Confirm sync',
  'project.materials.actions.createHandover': 'Create handover',
  'project.materials.actions.createLoan': 'Lend',
  'project.materials.actions.return': 'Receive return',
  'project.materials.fields.code': 'Material code',
  'project.materials.fields.identity': 'Material',
  'project.materials.fields.qrCode': 'QR Code',
  'project.materials.fields.holder': 'Current holder',
  'project.materials.fields.enable': 'Enable material {name}',
  'project.materials.fields.disable': 'Disable material {name}',
  'project.materials.fields.model': 'Material model',
  'project.materials.fields.name': 'Material name',
  'project.materials.fields.description': 'Description',
  'project.materials.fields.image': 'Material images',
  'project.materials.fields.imagePreview': 'Material image preview',
  'project.materials.fields.serialNumber': 'Serial number',
  'project.materials.fields.owner': 'Owner',
  'project.materials.fields.managedBy': 'Managing unit',
  'project.materials.fields.representative': 'Representative',
  'project.materials.fields.epsUnit': 'EPS unit',
  'project.materials.fields.initialOwner': 'Initial owner',
  'project.materials.sections.owner': 'Owning unit',
  'project.materials.fields.borrower': 'Borrowing party',
  'project.materials.fields.condition': 'Condition',
  'project.materials.fields.note': 'Note',
  'project.materials.fields.specifications': 'Specifications',
  'project.materials.fields.specificationName': 'Specification',
  'project.materials.fields.specificationValue': 'Value',
  'project.materials.fields.specificationEdit': 'Edit',
  'project.materials.fields.specificationVisible': 'Visible',
  'project.materials.fields.specificationPublicLabel':
    'Allow public viewers to see {name}',
  'project.materials.fields.specificationEditLabel': 'Allow editing {name}',
  'project.materials.fields.issuedDate': 'Issued',
  'project.materials.fields.status': 'Use status',
  'project.materials.fields.requiresInspection': 'Inspection required',
  'project.materials.fields.group': 'Material group',
  'project.materials.fields.createdAt': 'Created',
  'project.materials.fields.updatedAt': 'Last updated',
  'project.materials.filters.search':
    'Search code, name, model, or serial number',
  'project.materials.filters.model': 'Filter by model',
  'project.materials.filters.owner': 'Filter by owner',
  'project.materials.filters.borrower': 'Filter by borrower',
  'project.materials.filters.group': 'Filter by group',
  'project.materials.filters.status': 'Filter by status',
  'project.materials.filters.statusPlaceholder': 'All statuses',
  'project.materials.filters.condition': 'Filter by condition',
  'project.materials.empty.list': 'No materials yet.',
  'project.materials.empty.search': 'No matching materials found.',
  'project.materials.errors.loadTitle': 'Could not load materials',
  'project.materials.errors.loadFiltersTitle': 'Could not load list filters',
  'project.materials.errors.loadHandoversTitle':
    'Could not load related handovers',
  'project.materials.errors.loadHistoryTitle':
    'Could not load material history',
  'project.materials.errors.loadSyncTitle': 'Could not load model comparison',
  'project.materials.errors.loadCustodiansTitle': 'Could not load custodians',
  'project.materials.errors.authorizationTitle': 'Access denied',
  'project.materials.errors.notFoundTitle': 'Material not found',
  'project.materials.errors.loadDetailTitle': 'Could not load material details',
  'project.materials.errors.authorization':
    'You do not have permission to view this information.',
  'project.materials.errors.mixedStatuses':
    'Select materials with the same status to create one handover.',
  'project.materials.errors.notFound':
    'This material does not exist or has been deleted.',
  'project.materials.dialogs.deleteTitle': 'Confirm material deletion',
  'project.materials.dialogs.deleteConfirm': 'Delete material',
  'project.materials.dialogs.deleteDescription':
    'Are you sure you want to delete “{name}”? This action cannot be undone.',
  'project.materials.tabs.overview': 'Overview',
  'project.materials.tabs.general': 'General information',
  'project.materials.tabs.handoverHistory': 'Handover history',
  'project.materials.tabs.inventoryHistory': 'Inventory history',
  'project.materials.tabs.safety': 'Safety management',
  'project.materials.tabs.safetyChecklist': 'Safety inspection',
  'project.materials.safetyInspection.checklist.empty':
    'No inspection content groups have been added.',
  'project.materials.safetyInspection.checklist.group':
    'Inspection content group',
  'project.materials.safetyInspection.checklist.groupName':
    'Inspection content group {group} name',
  'project.materials.safetyInspection.checklist.groupNamePlaceholder':
    'Enter inspection content group name',
  'project.materials.safetyInspection.checklist.groupNameRequired':
    'Enter an inspection content group name.',
  'project.materials.safetyInspection.checklist.criterion':
    'Inspection content',
  'project.materials.safetyInspection.checklist.criterionNumber':
    'Inspection content {group}.{criterion}',
  'project.materials.safetyInspection.checklist.criterionPlaceholder':
    'Enter inspection content',
  'project.materials.safetyInspection.checklist.criterionRequired':
    'Enter inspection content.',
  'project.materials.safetyInspection.checklist.removeGroup':
    'Remove inspection content group {group}',
  'project.materials.safetyInspection.checklist.removeCriterion':
    'Remove content {criterion} in group {group}',
  'project.materials.safetyInspection.checklist.reorderGroup':
    'Drag to reorder group {group}',
  'project.materials.safetyInspection.checklist.reorderCriterion':
    'Drag to reorder content {criterion} in group {group}',
  'project.materials.safetyInspection.checklist.collapseGroup':
    'Collapse group {group}',
  'project.materials.safetyInspection.checklist.expandGroup':
    'Expand group {group}',
  'project.materials.safetyInspection.checklist.criteriaCount': '{count} items',
  'project.materials.safetyInspection.checklist.count':
    '{groups} groups · {criteria} items',
  'project.materials.safetyInspection.checklist.rowNumber': 'No.',
  'project.materials.safetyInspection.checklist.addCriterion': 'Add content',
  'project.materials.safetyInspection.checklist.addGroup':
    'Add inspection content group',
  'project.materials.safetyInspection.checklist.inheritedTitle':
    'Inherited checklist',
  'project.materials.safetyInspection.page.createTitle':
    'Create safety inspection',
  'project.materials.safetyInspection.page.detailTitle':
    'Safety inspection details',
  'project.materials.safetyInspection.page.createDescription':
    'Record the material inspection findings.',
  'project.materials.safetyInspection.toasts.created':
    'Safety inspection saved.',
  'project.materials.safetyInspection.sections.information':
    'Inspection information',
  'project.materials.safetyInspection.sections.checklist':
    'Inspection checklist',
  'project.materials.safetyInspection.fields.inspectedAt': 'Inspection time',
  'project.materials.safetyInspection.fields.inspector': 'Inspector',
  'project.materials.safetyInspection.fields.note': 'Overall note',
  'project.materials.safetyInspection.fields.result': 'Inspection result',
  'project.materials.safetyInspection.fields.criteriaResult': 'Pass',
  'project.materials.safetyInspection.fields.criteriaNote':
    'Inspection content note',
  'project.materials.safetyInspection.results.passed': 'Passed',
  'project.materials.safetyInspection.results.failed': 'Failed',
  'project.materials.safetyInspection.actions.create': 'Create inspection',
  'project.materials.safetyInspection.actions.save': 'Save inspection',
  'project.materials.safetyInspection.actions.back': 'Back to material details',
  'project.materials.safetyInspection.attachments.download': 'Download file',
  'project.materials.safetyInspection.attachments.unavailable':
    'Could not create a file download link.',
  'project.materials.safetyInspection.history.title': 'Inspection history',
  'project.materials.safetyInspection.history.description':
    'Safety inspection records created for this material.',
  'project.materials.safetyInspection.history.empty':
    'No safety inspections have been recorded for this material.',
  'project.materials.safetyInspection.history.loadTitle':
    'Could not load inspection history',
  'project.materials.safetyInspection.history.open':
    'Open inspection from {date}',
  'project.materials.safetyInspection.history.criteriaCount': '{count} items',
  'project.materials.safetyInspection.errors.noChecklist':
    'This material model has no inspection checklist. Add a checklist before creating an inspection.',
  'project.materials.safetyInspection.errors.notRequired':
    'Safety inspection is not enabled for this material model.',
  'project.materials.safetyInspection.errors.notFound':
    'This inspection does not exist or has been deleted.',
  'project.materials.safetyInspection.errors.fileTooLarge':
    'File "{fileName}" exceeds the 20 MB limit.',
  'project.materials.safetyInspection.validation.inspector':
    'Enter the inspector name.',
  'project.materials.safetyInspection.validation.result':
    'Select an inspection result.',
  'project.materials.tabs.repairs': 'Repair history',
  'project.materials.tabs.feedback': 'Feedback',
  'project.materials.tabs.specifications': 'Specifications',
  'project.materials.tabs.handovers': 'Handovers',
  'project.materials.tabs.history': 'History',
  'project.materials.tabs.related': 'Related handovers',
  'project.materials.fields.customInfo': 'Additional information',
  'project.materials.status.available': 'Available',
  'project.materials.status.loaned': 'On loan',
  'project.materials.condition.good': 'Good condition',
  'project.materials.condition.damaged': 'Damaged',
  'project.materials.sync.title': 'Preview model sync',
  'project.materials.sync.modelInformation': 'Model information',
  'project.materials.sync.specification': 'Specification: {name}',
  'project.materials.sync.groupChanged': 'Material group changed',
  'project.materials.actions.printQr': 'Print QR label',
  'project.materials.actions.expandImage': 'Expand material image',
  'project.materials.actions.expandQrCode':
    'Expand QR code for material {code}',
  'project.materials.actions.viewImage': 'View image',
  'project.materials.actions.openQrLink': 'Open detail link',
  'project.materials.sync.description':
    'Saved model information will be updated. The material name, description, images, and selected specifications will be preserved.',
  'project.materials.sync.empty': 'The model has no new changes.',
  'project.materials.sync.preserved': 'Material information preserved',
  'project.materials.sections.identity': 'Identification',
  'project.materials.sections.initialState': 'Initial information',
  'project.materials.sections.modelSnapshot': 'Saved model information',
  'project.materials.sections.specifications': 'Specifications',
  'project.materials.sections.currentState': 'Current state',
  'project.materials.sections.materialInfo': 'Material information',
  'project.materials.sections.qr': 'Material QR code',
  'project.materials.sections.printedQrLabel': 'Printed material QR label',
  'project.materials.form.chooseModelHint':
    'Choose a material model to preview information captured when the material is created.',
  'project.materials.form.publicDisplay.title': 'Publicly visible information',
  'project.materials.form.publicDisplay.basicInfo': 'Allow viewing material',
  'project.materials.form.publicDisplay.specifications':
    'Allow viewing technical specifications',
  'project.materials.publicDetail.title': 'Material information',
  'project.materials.publicDetail.basicInfo': 'Basic information',
  'project.materials.publicDetail.specifications': 'Technical specifications',
  'project.materials.publicDetail.emptySpecifications':
    'This material has no technical specifications.',
  'project.materials.publicDetail.notShared': 'This information is not public.',
  'project.materials.publicDetail.unavailable':
    'This material cannot be viewed.',
  'project.materials.publicDetail.unavailableDescription':
    'Public viewing is disabled for this material or it has been deactivated.',
  'project.materials.publicDetail.errors.loadTitle':
    'Could not load material information',
  'project.materials.form.inheritedSpecifications':
    'Inherited specifications ({count})',
  'project.materials.form.chooseSpecificationValue': 'Choose a suggested value',
  'project.materials.form.chooseSpecificationValues':
    'Choose one or more values',
  'project.materials.form.searchSpecificationValues': 'Search values',
  'project.materials.form.noRepresentedOwner':
    'Your account does not represent a custodian yet. Assign a representative before creating a material.',
  'project.materials.gallery.title': 'Material images',
  'project.materials.gallery.emptyTitle': 'Add material images',
  'project.materials.gallery.dropInstruction': 'Drop images here or',
  'project.materials.gallery.dropActive': 'Drop images to add to this material',
  'project.materials.gallery.chooseImages': 'Choose images',
  'project.materials.gallery.count': '{count} images',
  'project.materials.gallery.viewImage': 'View image {index}',
  'project.materials.gallery.add': 'Add images',
  'project.materials.gallery.cover': 'Cover image',
  'project.materials.gallery.setCover': 'Set as cover image',
  'project.materials.gallery.remove': 'Remove image',
  'project.materials.gallery.limit': 'A material can have up to 10 images.',
  'project.materials.gallery.invalidType': 'Choose JPG, PNG, or WEBP images.',
  'project.materials.gallery.tooLarge': 'Each image must be 5 MB or smaller.',
  'project.materials.gallery.coverRequired': 'Choose a cover image.',
  'project.materials.toasts.created': 'Material added.',
  'project.materials.toasts.updated': 'Material information updated.',
  'project.materials.toasts.activated': 'Material enabled.',
  'project.materials.toasts.deactivated': 'Material disabled.',
  'project.materials.toasts.deleted': 'Material “{name}” deleted.',
  'project.materials.toasts.deletedMultiple': '{count} materials deleted.',
  'project.materials.list.recordCountLabel': 'materials',
  'project.materials.empty.handovers': 'No related handovers yet.',
  'project.materials.empty.specifications':
    'This material model has no specifications.',
  'project.materials.empty.history': 'No history yet.',
  'project.materials.toasts.synced': 'Model information updated.',
  'project.materials.history.created': 'Material created',
  'project.materials.history.updated': 'Material information updated',
  'project.materials.history.model_synced': 'Model information updated',
  'project.materials.history.handover': 'Handover completed',
  'project.materials.handoverType.transfer': 'Ownership transfer',
  'project.materials.handoverType.loan': 'Loan',
  'project.materials.handoverType.return': 'Return',
  'project.materials.handoverStatus.draft': 'Draft',
  'project.materials.handoverStatus.pending': 'Pending confirmation',
  'project.materials.handoverStatus.completed': 'Completed',
  'project.materials.handoverStatus.rejected': 'Rejected',
  'project.materials.handoverStatus.cancelled': 'Cancelled',
  'project.materials.states.loading': 'Loading',
  'project.materials.states.error': 'An error occurred',
  'project.materials.states.loadFailed': 'Could not load information',
  'project.materials.states.lastPrintedLabel': 'Last printed label',
  'project.materials.states.notPrintedLabel':
    'No label printed for this material',
  'project.materials.states.reserved':
    'This material is reserved by an unfinished handover.',
  'project.materials.history.actor': 'Actor',
  'project.materials.history.changed': 'Changed',
  'project.materials.history.unknownActor': 'Account that performed the action',
  'project.materials.history.unknownParty': 'Custodian',
};
